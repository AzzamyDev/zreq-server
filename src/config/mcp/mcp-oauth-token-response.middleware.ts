import { NextFunction, Request, Response } from 'express'

/** Matches default authorize scopes when token response omits `scope` (some clients require it). */
const DEFAULT_TOKEN_SCOPE =
    'profile:read collections:read collections:write environments:read environments:write workspaces:read workspaces:write'

/**
 * Wraps `res.json` for POST /mcp/oauth/token:
 * - Coerce non-RFC error bodies (429, Prisma, Nest 500) to { error, error_description }
 * - Normalize success: token_type Bearer, optional scope
 * - One-line diagnostic log (no secrets)
 */
export const attachMcpTokenJsonWrapper = (req: Request, res: Response, next: NextFunction): void => {
    // Mounted at app.use('/mcp/oauth/token', …) — here req.path is relative to mount (e.g. "/"), not full path.
    if (req.method !== 'POST') {
        next()
        return
    }

    console.warn('[mcp-oauth] inbound POST /mcp/oauth/token')

    const origJson = res.json.bind(res)
    res.json = (body: unknown) => {
        const status = res.statusCode || 200

        if (status >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
            const b = body as Record<string, unknown>
            if (!('error' in b)) {
                const msg = [b.message, b.error].filter(Boolean).join('; ') || 'Request failed'
                let err = 'invalid_request'
                if (status === 401) err = 'invalid_client'
                if (status === 429) err = 'temporarily_unavailable'
                if (status >= 500) err = 'server_error'
                console.warn(`[MCP OAuth /token] ${status} -> RFC error ${err}: ${String(msg).slice(0, 200)}`)
                return origJson({ error: err, error_description: String(msg) })
            }
        }

        if (status === 200 && body && typeof body === 'object' && !Array.isArray(body)) {
            const o = body as Record<string, unknown>
            if (typeof o.access_token === 'string') {
                if (typeof o.token_type === 'string' && o.token_type.toLowerCase() === 'bearer') {
                    o.token_type = 'Bearer'
                }
                if (o.scope === undefined || o.scope === '') {
                    const raw =
                        req.body && typeof (req.body as Record<string, unknown>).scope === 'string'
                            ? String((req.body as Record<string, unknown>).scope).trim()
                            : ''
                    o.scope = raw.length > 0 ? raw : DEFAULT_TOKEN_SCOPE
                }
            }
        }

        if (status >= 400 || process.env.MCP_DEBUG_TOKEN === '1') {
            const keys =
                body && typeof body === 'object' && !Array.isArray(body)
                    ? Object.keys(body as object).join(',')
                    : typeof body
            console.warn(`[MCP OAuth /token] response ${status} keys=${keys}`)
        }

        return origJson(body)
    }

    next()
}
