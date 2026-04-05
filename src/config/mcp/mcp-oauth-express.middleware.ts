import { NextFunction, Request, Response } from 'express'

const WELL_AUTHZ = '/.well-known/oauth-authorization-server'
const WELL_RESOURCE = '/.well-known/oauth-protected-resource'

const rewriteHttpUrlOrigin = (url: unknown, originBase: string): unknown => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url
    try {
        const u = new URL(url)
        const b = new URL(originBase.endsWith('/') ? originBase : `${originBase}/`)
        return `${b.origin}${u.pathname}${u.search}`
    } catch {
        return url
    }
}

/**
 * Rekog embeds `MCP_SERVER_URL` into `.well-known` URLs. If that env points at ngrok/public
 * but Cursor uses `http://localhost:3300/mcp`, the IDE will POST the token elsewhere → no logs here.
 * Rewrite metadata to match the request Host (and X-Forwarded-* behind proxies).
 */
export const attachDynamicOAuthWellKnownMetadata = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
        next()
        return
    }
    const p = req.path
    if (p !== WELL_AUTHZ && p !== WELL_RESOURCE) {
        next()
        return
    }

    const origJson = res.json.bind(res)
    res.json = (body: unknown) => {
        const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || (req.secure ? 'https' : 'http')
        const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host')
        if (!host || !body || typeof body !== 'object' || Array.isArray(body)) {
            return origJson(body)
        }
        const base = `${proto}://${host}`
        const j = { ...(body as Record<string, unknown>) }

        if (p === WELL_AUTHZ) {
            for (const key of [
                'issuer',
                'authorization_endpoint',
                'token_endpoint',
                'registration_endpoint',
                'revocation_endpoint',
                'jwks_uri'
            ] as const) {
                if (key in j) j[key] = rewriteHttpUrlOrigin(j[key], base)
            }
        }

        if (p === WELL_RESOURCE && Array.isArray(j.authorization_servers)) {
            j.authorization_servers = j.authorization_servers.map((x: unknown) => rewriteHttpUrlOrigin(x, base))
        }

        return origJson(j)
    }

    next()
}
