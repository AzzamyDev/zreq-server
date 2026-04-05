import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import type { Request, Response } from 'express'

const TOKEN_PATH = '/mcp/oauth/token'

function flattenMessage(payload: string | Record<string, unknown>): string {
    if (typeof payload === 'string') return payload
    const m = payload?.message
    if (Array.isArray(m)) return m.map(String).join(', ')
    if (m != null && typeof m === 'string') return m
    if (m != null) return String(m)
    return 'Request failed'
}

function mapRfc6749Error(message: string, httpStatus: number): { error: string; httpStatus: number } {
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

/**
 * Cursor (and other strict OAuth clients) expect RFC 6749 error bodies on the token endpoint:
 * `{ "error", "error_description" }`. Nest's default `{ statusCode, message }` breaks their parser → "unknown error".
 */
@Catch(HttpException)
export class McpOAuthTokenHttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const req = ctx.getRequest<Request>()
        const res = ctx.getResponse<Response>()
        const status = exception.getStatus()
        const payload = exception.getResponse() as string | Record<string, unknown>

        const isTokenPost = req.path === TOKEN_PATH && req.method === 'POST'

        if (!isTokenPost) {
            if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
                res.status(status).json(payload)
                return
            }
            res.status(status).json({ statusCode: status, message: flattenMessage(payload as never) })
            return
        }

        const message = flattenMessage(payload)
        const { error, httpStatus } = mapRfc6749Error(message, status)
        console.warn(`[MCP OAuth POST ${TOKEN_PATH}] ${error}: ${message}`)

        res.status(httpStatus)
            .setHeader('Cache-Control', 'no-store')
            .setHeader('Pragma', 'no-cache')
            .json({ error, error_description: message })
    }
}
