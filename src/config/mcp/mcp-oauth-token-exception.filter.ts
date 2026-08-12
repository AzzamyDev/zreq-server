import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import type { Request, Response } from 'express'
import {
    flattenNestErrorMessage,
    isMcpOAuthTokenPost,
    mapRfc6749Error,
    MCP_OAUTH_TOKEN_PATH
} from './mcp-oauth-token.util'

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

        if (!isMcpOAuthTokenPost(req)) {
            if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
                res.status(status).json(payload)
                return
            }
            res.status(status).json({ statusCode: status, message: flattenNestErrorMessage(payload as never) })
            return
        }

        const message = flattenNestErrorMessage(payload)
        const { error, httpStatus } = mapRfc6749Error(message, status)
        console.warn(`[MCP OAuth POST ${MCP_OAUTH_TOKEN_PATH}] ${error}: ${message}`)

        res.status(httpStatus)
            .setHeader('Cache-Control', 'no-store')
            .setHeader('Pragma', 'no-cache')
            .json({ error, error_description: message })
    }
}
