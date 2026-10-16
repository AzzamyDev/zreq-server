import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from 'src/features/auth/auth.service'
import { resolveGithubOAuthEnv } from 'src/helpers/github-oauth-config'
import {
    errorBodyHtml,
    loginFormHtml,
    oauthPageShell
} from 'src/helpers/oauth-pages'

@Controller('mcp/oauth')
export class McpLocalLoginController {
    constructor(private readonly authService: AuthService) {}

    private resolveSafeNext(next: unknown): string {
        const callbackPath = process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback'
        return typeof next === 'string' && next.startsWith('/') ? next : callbackPath
    }

    private isGithubConfigured(): boolean {
        return !!resolveGithubOAuthEnv(
            process.env.GITHUB_CLIENT_ID,
            process.env.GITHUB_CALLBACK_URL
        )
    }

    private sendLoginPage(
        res: Response,
        opts: { safeNext: string; status?: number; error?: string; email?: string }
    ): void {
        const html = oauthPageShell({
            title: 'ZReq MCP Login',
            pill: 'MCP authorization',
            cardTitle: 'Sign in',
            cardDescription: 'Sign in to your account to authorize MCP access.',
            body: loginFormHtml({
                safeNext: opts.safeNext,
                githubConfigured: this.isGithubConfigured(),
                error: opts.error,
                email: opts.email
            })
        })
        res.status(opts.status ?? 200).type('html').send(html)
    }

    @Get('local-login')
    renderLogin(@Req() req: Request, @Res() res: Response): void {
        this.sendLoginPage(res, { safeNext: this.resolveSafeNext(req.query.next) })
    }

    @Get('github-start')
    githubMcpStart(@Req() req: Request, @Res() res: Response): void {
        const github = resolveGithubOAuthEnv(
            process.env.GITHUB_CLIENT_ID,
            process.env.GITHUB_CALLBACK_URL
        )
        if (!github) {
            const html = oauthPageShell({
                title: 'ZReq — GitHub unavailable',
                pill: 'MCP authorization',
                cardTitle: 'GitHub sign-in unavailable',
                cardDescription: 'GitHub OAuth is not configured on this server.',
                body: errorBodyHtml({
                    message: 'Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and a real GITHUB_CALLBACK_URL, then restart the server.',
                    backHref: `/mcp/oauth/local-login?next=${encodeURIComponent(this.resolveSafeNext(req.query.next))}`
                })
            })
            res.status(500).type('html').send(html)
            return
        }
        const safeNext = this.resolveSafeNext(req.query.next)
        ;(req as any).session.mcpPendingNext = safeNext
        const state = this.authService.createGithubOAuthState('mcp')
        const params = new URLSearchParams({
            client_id: github.clientId,
            redirect_uri: github.callbackUrl,
            scope: 'read:user user:email',
            state
        })
        res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
    }

    @Post('local-login')
    async submitLogin(
        @Req() req: Request,
        @Res() res: Response,
        @Body('email') email: string,
        @Body('password') password: string,
        @Body('next') next?: string
    ): Promise<void> {
        const safeNext = this.resolveSafeNext(next)
        try {
            const result = await this.authService.login({ email, password })
            ;(req as any).session.mcpUserEmail = result.user.email
            res.redirect(safeNext)
        } catch {
            this.sendLoginPage(res, {
                safeNext,
                status: 401,
                error: 'Invalid email or password',
                email: typeof email === 'string' ? email : ''
            })
        }
    }
}
