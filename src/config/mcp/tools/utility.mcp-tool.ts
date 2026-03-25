import { Injectable } from '@nestjs/common'
import { PublicTool, Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { WorkspacesService } from 'src/features/workspaces/workspaces.service'
import { McpIdentityService } from '../mcp-identity.service'

@Injectable()
export class UtilityMcpTool {
    constructor(
        private readonly identityService: McpIdentityService,
        private readonly workspacesService: WorkspacesService
    ) {}

    @PublicTool()
    @Tool({
        name: 'system_health',
        description: 'Health check for MCP server',
        parameters: z.object({})
    })
    async health() {
        return { ok: true, message: 'MCP server is healthy', data: { service: 'zreq-mcp' } }
    }

    @ToolScopes(['profile:read'])
    @Tool({
        name: 'auth_whoami',
        description: 'Resolve current MCP user',
        parameters: z.object({})
    })
    async whoami(_args: Record<string, never>, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        return {
            ok: true,
            message: 'Authenticated MCP user resolved',
            data: {
                userId,
                email: req?.user?.email ?? null,
                username: req?.user?.username ?? null
            }
        }
    }

    @ToolScopes(['workspaces:read'])
    @Tool({
        name: 'workspaces_accessible_ids',
        description: 'Get list of workspace ids accessible to user',
        parameters: z.object({})
    })
    async accessibleWorkspaceIds(
        _args: Record<string, never>,
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const ids = await this.workspacesService.getAccessibleWorkspaceIds(userId)
        return {
            ok: true,
            message: 'Accessible workspace ids fetched successfully',
            data: { userId, workspaceIds: ids }
        }
    }
}
