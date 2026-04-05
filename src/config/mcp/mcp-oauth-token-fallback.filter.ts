import { ArgumentsHost, Catch, HttpException } from '@nestjs/common'
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core'
import type { Request, Response } from 'express'

const TOKEN_PATH = '/mcp/oauth/token'

/**
 * Non-HttpException errors on the token endpoint otherwise become Nest's generic 500 JSON;
 * strict OAuth clients fail to parse → "unknown error".
 */
@Catch()
export class McpOAuthTokenFallbackFilter extends BaseExceptionFilter {
    constructor(adapterHost: HttpAdapterHost) {
        super(adapterHost.httpAdapter)
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const req = ctx.getRequest<Request>()
        const isTokenPost = req.path === TOKEN_PATH && req.method === 'POST'

        if (isTokenPost && !(exception instanceof HttpException)) {
            const res = ctx.getResponse<Response>()
            const msg = exception instanceof Error ? exception.message : String(exception)
            console.error(`[MCP OAuth POST ${TOKEN_PATH}] unhandled exception:`, exception)
            res.status(500)
                .setHeader('Cache-Control', 'no-store')
                .setHeader('Pragma', 'no-cache')
                .json({ error: 'server_error', error_description: msg })
            return
        }

        super.catch(exception, host)
    }
}
