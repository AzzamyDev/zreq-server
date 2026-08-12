import type { Request } from 'express'

export const MCP_OAUTH_TOKEN_PATH = '/mcp/oauth/token'

export const isMcpOAuthTokenPost = (req: Request): boolean => {
    if (req.method !== 'POST') return false
    const path = req.path || ''
    const url = (req.originalUrl || req.url || '').split('?')[0]
    return path === MCP_OAUTH_TOKEN_PATH || url === MCP_OAUTH_TOKEN_PATH || url.endsWith(MCP_OAUTH_TOKEN_PATH)
}

export const flattenNestErrorMessage = (payload: string | Record<string, unknown>): string => {
    if (typeof payload === 'string') return payload
    const m = payload?.message
    if (Array.isArray(m)) return m.map(String).join(', ')
    if (m != null && typeof m === 'string') return m
    if (m != null) return String(m)
    return 'Request failed'
}

export const mapRfc6749Error = (
    message: string,
    httpStatus: number
): { error: string; httpStatus: number } => {
    if (httpStatus >= 500) return { error: 'server_error', httpStatus: 500 }
    const lower = message.toLowerCase()
    if (
        lower.includes('client credentials') ||
        lower.includes('invalid client') ||
        lower.includes('client secret') ||
        lower.includes('not allowed for public clients')
    ) {
        return { error: 'invalid_client', httpStatus: 401 }
    }
    if (
        lower.includes('authorization code') ||
        lower.includes('invalid or expired') ||
        lower.includes('expired') ||
        lower.includes('pkce') ||
        lower.includes('code has expired') ||
        (lower.includes('invalid') && lower.includes('code'))
    ) {
        return { error: 'invalid_grant', httpStatus: 400 }
    }
    if (lower.includes('grant_type') || lower.includes('unsupported grant')) {
        return { error: 'unsupported_grant_type', httpStatus: 400 }
    }
    if (lower.includes('missing') && lower.includes('client')) {
        return { error: 'invalid_client', httpStatus: 401 }
    }
    return { error: 'invalid_request', httpStatus: httpStatus >= 400 && httpStatus < 500 ? httpStatus : 400 }
}

export const toRfc6749ErrorBody = (
    status: number,
    body: Record<string, unknown>
): { error: string; error_description: string; httpStatus: number } => {
    const message = flattenNestErrorMessage(body)
    const { error, httpStatus } = mapRfc6749Error(message, status)
    return { error, error_description: message, httpStatus }
}

export const isNestHttpErrorBody = (body: Record<string, unknown>): boolean =>
    'statusCode' in body && body.message != null
