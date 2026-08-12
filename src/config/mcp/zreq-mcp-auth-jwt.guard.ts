import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { McpAuthJwtGuard } from '@rekog/mcp-nest'
import { DEFAULT_MCP_SCOPE } from './mcp-scopes.constant'

type McpUserPayload = {
    scope?: string
    scopes?: string[]
}

type McpUserRequest = { user?: McpUserPayload }

/**
 * Cursor often omits `scope` on authorize → JWT scope is empty → scoped tools hidden from tools/list.
 * Apply default scopes on every authenticated MCP request (incl. existing tokens).
 */
@Injectable()
export class ZreqMcpAuthJwtGuard extends McpAuthJwtGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const ok = await super.canActivate(context)
        const req = context.switchToHttp().getRequest<McpUserRequest>()
        const user = req.user
        if (!user) return ok

        const scope = typeof user.scope === 'string' ? user.scope.trim() : ''
        if (!scope) {
            user.scope = DEFAULT_MCP_SCOPE
            user.scopes = DEFAULT_MCP_SCOPE.split(' ')
        } else if (!user.scopes?.length) {
            user.scopes = scope.split(' ').filter(Boolean)
        }

        return ok
    }
}
