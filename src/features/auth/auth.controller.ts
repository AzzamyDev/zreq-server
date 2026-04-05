import {
    Controller,
    Post,
    Body,
    Get,
    Query,
    Res,
    Req,
    InternalServerErrorException,
    BadRequestException
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { sendHtmlRedirect } from 'src/config/oauth-html-redirect.util'

/**
 * Web SPA: hash (works with static hosting).
 * Custom scheme (Tauri): query string — OS/handlers often strip `#fragment` from deep links.
 */
function buildOauthFrontendRedirect(frontendBase: string | undefined, fragment: string): string {
    const raw = (frontendBase?.trim() || 'http://localhost:5173/').trim()
    const base = raw.replace(/\/$/, '')
    if (/^https?:\/\//i.test(base)) {
        return `${base}/#${fragment}`
    }
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}${fragment}`
}

function publicApiOrigin(req: Request): string {
    const xfProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const xfHost = req.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = xfHost || req.get('host') || 'localhost'
    const proto = xfProto || (req.secure ? 'https' : 'http')
    return `${proto}://${host}`
}

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService
    ) {}

    @Post('register')
    async register(@Body() dto: RegisterDto) {
        const result = await this.authService.register(dto)
        return { message: 'Registration successful', data: result }
    }

    @Post('login')
    async login(@Body() dto: LoginDto) {
        const result = await this.authService.login(dto)
        return { message: 'Login successful', data: result }
    }

    @Get('oauth-bridge')
    async oauthBridge(@Query('code') code: string) {
        const c = code?.trim()
        if (!c) throw new BadRequestException('Missing code')
        const data = this.authService.consumeOAuthBridge(c)
        if (!data) throw new BadRequestException('Invalid or expired code')
        return { message: 'OK', data }
    }

    @Get('github')
    githubStart(@Res({ passthrough: false }) res: Response): void {
        const clientId = this.configService.get<string>('GITHUB_CLIENT_ID')
        const callbackUrl = this.configService.get<string>('GITHUB_CALLBACK_URL')
        if (!clientId || !callbackUrl) {
            throw new InternalServerErrorException('GitHub OAuth is not configured')
        }
        const state = this.authService.createGithubOAuthState()
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: 'read:user user:email',
            state
        })
        const url = `https://github.com/login/oauth/authorize?${params.toString()}`
        sendHtmlRedirect(res, url)
    }

    @Get('github/callback')
    async githubCallback(
        @Req() req: Request,
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') oauthError: string,
        @Query('error_description') oauthDesc: string,
        @Res({ passthrough: false }) res: Response
    ): Promise<void> {
        const front = this.configService.get<string>('FRONTEND_OAUTH_URL')
        if (oauthError) {
            const fragment = new URLSearchParams({
                oauth_error: oauthDesc || oauthError
            }).toString()
            sendHtmlRedirect(res, buildOauthFrontendRedirect(front, fragment))
            return
        }
        if (!code || !state) {
            const fragment = new URLSearchParams({
                oauth_error: 'Missing authorization code'
            }).toString()
            sendHtmlRedirect(res, buildOauthFrontendRedirect(front, fragment))
            return
        }
        try {
            const { ctx } = this.authService.verifyGithubOAuthState(state)
            const result = await this.authService.completeGithubOAuth(code, state)

            if (ctx === 'mcp') {
                ;(req as any).session.mcpUserEmail = result.user.email
                const mcpNext = (req as any).session.mcpPendingNext as string | undefined
                if ((req as any).session.mcpPendingNext) delete (req as any).session.mcpPendingNext
                const callbackPath = process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback'
                const safeNext =
                    typeof mcpNext === 'string' && mcpNext.startsWith('/') ? mcpNext : callbackPath
                sendHtmlRedirect(res, safeNext)
                return
            }

            const bridge = this.authService.createOAuthBridge(result)
            const fragment = new URLSearchParams({
                code: bridge,
                api: publicApiOrigin(req)
            }).toString()
            sendHtmlRedirect(res, buildOauthFrontendRedirect(front, fragment))
        } catch (e: unknown) {
            const msg =
                typeof e === 'object' && e !== null && 'message' in e
                    ? String((e as { message: string }).message)
                    : 'GitHub sign-in failed'
            const fragment = new URLSearchParams({ oauth_error: msg }).toString()
            sendHtmlRedirect(res, buildOauthFrontendRedirect(front, fragment))
        }
    }
}
