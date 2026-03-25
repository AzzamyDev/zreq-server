import type { Request } from 'express'
import { Strategy as PassportStrategy } from 'passport-strategy'
import type { OAuthProviderConfig } from '@rekog/mcp-nest'

type VerifyFn = (
    accessToken: string,
    refreshToken: string,
    profile: unknown,
    done: (error: Error | null, user?: unknown) => void
) => void

type StrategyOptions = {
    defaultEmail?: string
    defaultName?: string
    callbackPath?: string
    loginPath?: string
    allowDefaultIdentity?: boolean
    allowExternalIdentityHints?: boolean
}

export class LocalAccountOAuthStrategy extends PassportStrategy {
    name = 'local-account-oauth'

    constructor(
        private readonly options: StrategyOptions,
        private readonly verify: VerifyFn
    ) {
        super()
    }

    authenticate(req: Request) {
        const callbackPath = this.options.callbackPath || '/mcp/oauth/callback'
        const loginPath = this.options.loginPath || '/mcp/oauth/local-login'
        const allowExternalIdentityHints = !!this.options.allowExternalIdentityHints
        const isCallbackRequest =
            req.path === callbackPath ||
            req.originalUrl === callbackPath ||
            req.originalUrl?.startsWith(`${callbackPath}?`)

        if (!isCallbackRequest) {
            const hasIdentityHint =
                typeof (req as any).session?.mcpUserEmail === 'string' ||
                (allowExternalIdentityHints &&
                    (typeof req.headers['x-mcp-user-email'] === 'string' ||
                        typeof req.query.login_hint === 'string'))
            if (hasIdentityHint) return (this as any).redirect(callbackPath)
            return (this as any).redirect(`${loginPath}?next=${encodeURIComponent(callbackPath)}`)
        }

        const sessionEmail = (req as any).session?.mcpUserEmail
        const headerEmail = allowExternalIdentityHints ? req.headers['x-mcp-user-email'] : undefined
        const queryEmail =
            allowExternalIdentityHints && typeof req.query.login_hint === 'string'
                ? req.query.login_hint
                : undefined
        const allowDefaultIdentity = !!this.options.allowDefaultIdentity
        const emailCandidate =
            (typeof sessionEmail === 'string' ? sessionEmail : undefined) ||
            (typeof headerEmail === 'string' ? headerEmail : undefined) ||
            queryEmail ||
            (allowDefaultIdentity ? this.options.defaultEmail : undefined)

        const email = emailCandidate?.trim().toLowerCase()
        if (!email) {
            return (this as any).fail({
                message: 'Missing user identity. Login via /mcp/oauth/local-login first.'
            })
        }

        const profile = {
            id: email,
            username: email,
            email,
            displayName: this.options.defaultName || email.split('@')[0] || 'MCP User'
        }

        this.verify('', '', profile, (error, user) => {
            if (error) return (this as any).error(error)
            if ((req as any).session?.mcpUserEmail) delete (req as any).session.mcpUserEmail
            ;(this as any).success(user)
        })
    }
}

export const LocalAccountOAuthProvider: OAuthProviderConfig = {
    name: 'local-account',
    displayName: 'Local Account',
    strategy: LocalAccountOAuthStrategy,
    strategyOptions: () => ({
        defaultEmail: process.env.MCP_DEFAULT_USER_EMAIL || '',
        defaultName: process.env.MCP_DEFAULT_USER_NAME || 'MCP User',
        callbackPath: process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback',
        loginPath: process.env.MCP_OAUTH_LOCAL_LOGIN_PATH || '/mcp/oauth/local-login',
        allowDefaultIdentity:
            process.env.MCP_ALLOW_DEFAULT_IDENTITY === 'true' || process.env.NODE_ENV !== 'production',
        allowExternalIdentityHints:
            process.env.MCP_ALLOW_EXTERNAL_IDENTITY_HINTS === 'true' || process.env.NODE_ENV !== 'production'
    }),
    scope: ['profile:read'],
    profileMapper: (profile) => {
        const row = profile as {
            id?: string
            username?: string
            email?: string
            displayName?: string
        }
        const email = row.email?.trim().toLowerCase() || 'mcp-user@local'
        return {
            id: row.id || email,
            username: row.username || email,
            email,
            displayName: row.displayName || email.split('@')[0] || 'MCP User',
            raw: profile
        }
    }
}
