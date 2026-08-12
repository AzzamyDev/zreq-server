import { NextFunction, Request, Response } from 'express'
import {
    isNestHttpErrorBody,
    toRfc6749ErrorBody
} from './mcp-oauth-token.util'

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

    const body = req.body as Record<string, unknown> | undefined
    const verifierLen =
        body && typeof body.code_verifier === 'string' ? body.code_verifier.trim().length : 0
    console.warn(
        `[mcp-oauth] inbound POST /mcp/oauth/token grant=${String(body?.grant_type ?? '')} verifier_len=${verifierLen}`
    )

    const origJson = res.json.bind(res)
    res.json = (payload: unknown) => {
        const status = res.statusCode || 200

        if (status >= 400 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
            const b = payload as Record<string, unknown>
            if (isNestHttpErrorBody(b) || !('error' in b)) {
                const { error, error_description, httpStatus } = toRfc6749ErrorBody(status, b)
                console.warn(`[MCP OAuth /token] ${status} -> RFC error ${error}: ${error_description.slice(0, 200)}`)
                return origJson({ error, error_description })
            }
        }

        if (status === 200 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
            const o = payload as Record<string, unknown>
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
                payload && typeof payload === 'object' && !Array.isArray(payload)
                    ? Object.keys(payload as object).join(',')
                    : typeof payload
            console.warn(`[MCP OAuth /token] response ${status} keys=${keys}`)
        }

        return origJson(payload)
    }

    next()
}
