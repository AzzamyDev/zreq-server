import { Injectable, NotFoundException } from '@nestjs/common'
import { PublicTool, Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { WorkspacesService } from 'src/features/workspaces/workspaces.service'
import { CollectionsService } from 'src/features/collections/collections.service'
import { EnvironmentsService } from 'src/features/environments/environments.service'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { McpIdentityService } from '../mcp-identity.service'

@Injectable()
export class UtilityMcpTool {
    constructor(
        private readonly identityService: McpIdentityService,
        private readonly workspacesService: WorkspacesService,
        private readonly collectionsService: CollectionsService,
        private readonly environmentsService: EnvironmentsService,
        private readonly prisma: PrismaService
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

    @ToolScopes(['workspaces:read', 'collections:read', 'environments:read'])
    @Tool({
        name: 'workspace_get_context',
        description:
            'Get full context for a workspace: workspace details, its collections, and environments in that workspace. ' +
            'Call this after workspaces_list to orient before working within a specific workspace.',
        parameters: z.object({ workspaceId: z.number().int().positive() })
    })
    async getWorkspaceContext(
        args: { workspaceId: number },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const [allWorkspaces, collections, environments] = await Promise.all([
            this.workspacesService.findAll(userId),
            this.collectionsService.findAll(userId, args.workspaceId),
            this.environmentsService.findAll(userId, args.workspaceId)
        ])
        const workspace = allWorkspaces.find((w) => w.id === args.workspaceId)
        if (!workspace) {
            throw new NotFoundException(`Workspace ${args.workspaceId} not found or not accessible`)
        }
        return {
            ok: true,
            message: 'Workspace context fetched successfully',
            data: { workspace, collections, environments }
        }
    }

    @ToolScopes(['profile:read'])
    @Tool({
        name: 'auth_logout',
        description:
            'Revoke current MCP session. Deletes stored OAuth profile, forcing re-authentication on next connection. ' +
            'Note: the current access token remains valid until it expires naturally.',
        parameters: z.object({})
    })
    async logout(_args: Record<string, never>, _context: unknown, req?: McpRequestWithUser) {
        const email = req?.user?.email
        if (email) {
            await this.prisma.oAuthUserProfileStore.deleteMany({
                where: { providerUserId: email.trim().toLowerCase() }
            })
        }
        return {
            ok: true,
            message:
                'MCP session revoked. To complete logout, remove and re-add this MCP server in your IDE. ' +
                'Your current session remains active until the access token expires.'
        }
    }
}
