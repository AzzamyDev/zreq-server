import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NotFoundExceptionFilter } from './config/exception/NotFoundExceptionFilter'
import { McpOAuthTokenFallbackFilter } from './config/mcp/mcp-oauth-token-fallback.filter'
import { McpOAuthTokenHttpExceptionFilter } from './config/mcp/mcp-oauth-token-exception.filter'
import { attachMcpTokenJsonWrapper } from './config/mcp/mcp-oauth-token-response.middleware'
import { NestExpressApplication } from '@nestjs/platform-express'
import { json, NextFunction, Request, Response, urlencoded } from 'express'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import { hashClientSecret, isHashedClientSecret } from './config/mcp/oauth-security.util'
import { isNonHttpAppUrl, sendHtmlRedirect } from './config/oauth-html-redirect.util'

const passport: any = require('passport')

/** Default express.json() limit is 100kb; large Postman imports exceed it (413). */
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb'

const PORT = process.env.PORT || 3000

const toInt = (value: string | undefined, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const createRateLimitMiddleware = (limit: number, windowMs: number) => {
    const hits = new Map<string, { count: number; resetAt: number }>()
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now()
        const key = `${req.path}:${req.ip || req.socket.remoteAddress || 'unknown'}`
        const row = hits.get(key)
        if (!row || row.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs })
            return next()
        }
        row.count += 1
        if (row.count > limit) {
            return res.status(429).json({ statusCode: 429, message: 'Too many requests' })
        }
        return next()
    }
}

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule)
    app.set('trust proxy', 1)

    const httpAdapter = app.getHttpAdapter()
    const expressApp = httpAdapter.getInstance() as import('express').Express
    expressApp.use((req, res, next) => {
        const orig = res.redirect.bind(res)
        res.redirect = ((statusOrUrl: string | number, url?: string) => {
            if (typeof statusOrUrl === 'number' && url !== undefined && isNonHttpAppUrl(url)) {
                sendHtmlRedirect(res, url, 'generic-app')
                return res
            }
            if (typeof statusOrUrl === 'string' && isNonHttpAppUrl(statusOrUrl)) {
                sendHtmlRedirect(res, statusOrUrl, 'generic-app')
                return res
            }
            return url !== undefined ? orig(statusOrUrl as number, url) : orig(statusOrUrl as string)
        }) as typeof res.redirect
        next()
    })

    passport.serializeUser((user, done) => done(null, user))
    passport.deserializeUser((user: any, done: (err: any, user?: any) => void) => done(null, user))

    app.use(json({ limit: BODY_LIMIT }))
    app.use(urlencoded({ extended: true, limit: BODY_LIMIT }))
    app.use(cookieParser())
    app.use(
        session({
            secret: process.env.MCP_SESSION_SECRET || process.env.MCP_JWT_SECRET || 'zreq-mcp-session-dev-secret',
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 1000 * 60 * 30
            }
        })
    )
    app.use(passport.initialize())
    app.use(passport.session())
    app.use('/mcp/oauth/token', attachMcpTokenJsonWrapper)
    app.use('/mcp/oauth/token', (req: Request, _res: Response, next: NextFunction) => {
        const auth = req.headers.authorization
        if (auth?.startsWith('Basic ')) {
            const raw = Buffer.from(auth.slice(6), 'base64').toString('utf8')
            const idx = raw.indexOf(':')
            if (idx >= 0) {
                const clientId = raw.slice(0, idx).trim()
                const clientSecret = raw.slice(idx + 1).trim()
                // Public clients use empty secret; hashing "" or whitespace breaks auth_method "none".
                if (clientSecret.length > 0) {
                    const hashed = isHashedClientSecret(clientSecret) ? clientSecret : hashClientSecret(clientSecret)
                    req.headers.authorization = `Basic ${Buffer.from(`${clientId}:${hashed}`).toString('base64')}`
                } else if (clientId.length > 0) {
                    req.headers.authorization = `Basic ${Buffer.from(`${clientId}:`).toString('base64')}`
                }
            }
        }
        const body = req.body as Record<string, unknown> | undefined
        if (body) {
            for (const k of ['client_id', 'code', 'redirect_uri', 'code_verifier', 'grant_type'] as const) {
                const v = body[k]
                if (typeof v === 'string') body[k] = v.trim()
            }
            if (typeof body.client_secret === 'string') {
                const s = body.client_secret.trim()
                if (s.length === 0) {
                    delete body.client_secret
                } else if (!isHashedClientSecret(s)) {
                    body.client_secret = hashClientSecret(s)
                } else {
                    body.client_secret = s
                }
            }
        }
        next()
    })

    const oauthWindowMs = toInt(process.env.MCP_OAUTH_RATE_LIMIT_WINDOW_MS, 60_000)
    const authorizeLimiter = createRateLimitMiddleware(
        toInt(process.env.MCP_OAUTH_RATE_LIMIT_AUTHORIZE, 60),
        oauthWindowMs
    )
    const registerLimiter = createRateLimitMiddleware(
        toInt(process.env.MCP_OAUTH_RATE_LIMIT_REGISTER, 20),
        oauthWindowMs
    )
    const tokenLimiter = createRateLimitMiddleware(
        toInt(process.env.MCP_OAUTH_RATE_LIMIT_TOKEN, 30),
        oauthWindowMs
    )
    const loginLimiter = createRateLimitMiddleware(
        toInt(process.env.MCP_OAUTH_RATE_LIMIT_LOCAL_LOGIN, 10),
        oauthWindowMs
    )
    app.use('/mcp/oauth/authorize', authorizeLimiter)
    app.use('/mcp/oauth/register', registerLimiter)
    app.use('/mcp/oauth/token', tokenLimiter)
    app.use('/mcp/oauth/local-login', loginLimiter)

    app.enableCors({
        origin: '*'
    })

    const adapterHost = app.get(HttpAdapterHost)
    app.useGlobalFilters(
        new McpOAuthTokenHttpExceptionFilter(),
        new NotFoundExceptionFilter(),
        new McpOAuthTokenFallbackFilter(adapterHost)
    )
    // app.setGlobalPrefix('api')
    await app.listen(PORT)

    const MCP_PORT = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : null
    if (MCP_PORT && MCP_PORT !== Number(PORT)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const http = require('http') as typeof import('http')
        const expressApp = app.getHttpAdapter().getInstance()
        const mcpServer = http.createServer(expressApp)
        mcpServer.listen(MCP_PORT, () => {
            console.log(`[MCP] Secondary listener on port ${MCP_PORT}`)
        })
    }
}
bootstrap()
