import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from 'src/features/auth/auth.service'

@Controller('mcp/oauth')
export class McpLocalLoginController {
    constructor(private readonly authService: AuthService) {}

    @Get('local-login')
    renderLogin(@Req() req: Request, @Res() res: Response): void {
        const callbackPath = process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback'
        const next = typeof req.query.next === 'string' ? req.query.next : callbackPath
        const safeNext = next.startsWith('/') ? next : callbackPath
        const githubConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CALLBACK_URL)
        const githubButton = githubConfigured
            ? `<hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
  <a href="/mcp/oauth/github-start?next=${encodeURIComponent(safeNext)}"
     style="display:block;text-align:center;padding:10px;border:1px solid #ccc;border-radius:8px;text-decoration:none;color:#111;font-weight:600">
    Continue with GitHub
  </a>`
            : ''

        res.status(200).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZReq MCP Login</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:360px;margin:48px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 8px}
    p{margin:0 0 20px;color:#444}
    label{display:block;font-size:14px;margin:12px 0 6px}
    input{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box}
    button{margin-top:16px;width:100%;padding:10px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <h1>Sign in to continue</h1>
  <p>Login with your ZReq account to authorize MCP access.</p>
  <form method="post" action="/mcp/oauth/local-login">
    <input type="hidden" name="next" value="${safeNext}" />
    <label>Email</label>
    <input name="email" type="email" required />
    <label>Password</label>
    <input name="password" type="password" required />
    <button type="submit">Continue</button>
  </form>${githubButton}
</body>
</html>`)
    }

    @Get('github-start')
    githubMcpStart(@Req() req: Request, @Res() res: Response): void {
        const clientId = process.env.GITHUB_CLIENT_ID
        const callbackUrl = process.env.GITHUB_CALLBACK_URL
        if (!clientId || !callbackUrl) {
            res.status(500).type('html').send('<p>GitHub OAuth is not configured on this server.</p>')
            return
        }
        const callbackPath = process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback'
        const next = typeof req.query.next === 'string' ? req.query.next : callbackPath
        const safeNext = next.startsWith('/') ? next : callbackPath
        ;(req as any).session.mcpPendingNext = safeNext
        const state = this.authService.createGithubOAuthState('mcp')
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
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
        try {
            const result = await this.authService.login({ email, password })
            ;(req as any).session.mcpUserEmail = result.user.email
            const callbackPath = process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback'
            const safeNext = next && next.startsWith('/') ? next : callbackPath
            res.redirect(safeNext)
        } catch {
            throw new UnauthorizedException('Invalid email or password')
        }
    }
}
