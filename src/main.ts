import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NotFoundExceptionFilter } from './config/exception/NotFoundExceptionFilter'
import { NestExpressApplication } from '@nestjs/platform-express'
import { json, NextFunction, Request, Response, urlencoded } from 'express'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import { hashClientSecret, isHashedClientSecret } from './config/mcp/oauth-security.util'

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
    app.use('/mcp/oauth/token', (req: Request, _res: Response, next: NextFunction) => {
        const auth = req.headers.authorization
        if (auth?.startsWith('Basic ')) {
            const raw = Buffer.from(auth.slice(6), 'base64').toString('utf8')
            const idx = raw.indexOf(':')
            if (idx >= 0) {
                const clientId = raw.slice(0, idx)
                const clientSecret = raw.slice(idx + 1)
                const hashed = isHashedClientSecret(clientSecret) ? clientSecret : hashClientSecret(clientSecret)
                req.headers.authorization = `Basic ${Buffer.from(`${clientId}:${hashed}`).toString('base64')}`
            }
        }
        const body = req.body as Record<string, unknown> | undefined
        if (body && typeof body.client_secret === 'string' && !isHashedClientSecret(body.client_secret)) {
            body.client_secret = hashClientSecret(body.client_secret)
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

    app.useGlobalFilters(new NotFoundExceptionFilter())
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
