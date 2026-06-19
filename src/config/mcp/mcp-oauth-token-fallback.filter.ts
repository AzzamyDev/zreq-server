import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common'
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core'
import type { Request, Response } from 'express'

function isPrismaNotFound(exception: unknown): exception is { code: string; meta?: { modelName?: string } } {
    return (
        typeof exception === 'object' &&
        exception !== null &&
        'code' in exception &&
        (exception as { code: string }).code === 'P2025'
    )
}

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

        if (isPrismaNotFound(exception)) {
            const res = ctx.getResponse<Response>()
            const modelName = exception.meta?.modelName
            res.status(HttpStatus.NOT_FOUND).json({
                statusCode: HttpStatus.NOT_FOUND,
                message: modelName ? `Data ${modelName} not found` : 'Data not found'
            })
            return
        }

        super.catch(exception, host)
    }
}
