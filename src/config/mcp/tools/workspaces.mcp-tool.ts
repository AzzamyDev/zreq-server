import { Injectable } from '@nestjs/common'
import { Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { WorkspacesService } from 'src/features/workspaces/workspaces.service'
import { McpIdentityService } from '../mcp-identity.service'

@Injectable()
export class WorkspacesMcpTool {
    constructor(
        private readonly workspacesService: WorkspacesService,
        private readonly identityService: McpIdentityService
    ) {}

    @ToolScopes(['workspaces:read'])
    @Tool({
        name: 'workspaces_list',
        description: 'List workspaces accessible by user',
        parameters: z.object({})
    })
    async list(_args: Record<string, never>, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.workspacesService.findAll(userId)
        return { ok: true, message: 'Workspaces fetched successfully', data }
    }

    @ToolScopes(['workspaces:write'])
    @Tool({
        name: 'workspaces_create',
        description: 'Create workspace',
        parameters: z.object({ name: z.string().min(1).max(120) })
    })
    async create(args: { name: string }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.workspacesService.create(userId, args)
        return { ok: true, message: 'Workspace created successfully', data }
    }

    @ToolScopes(['workspaces:write'])
    @Tool({
        name: 'workspaces_update',
        description: 'Update workspace',
        parameters: z.object({
            id: z.number().int().positive(),
            name: z.string().min(1).max(120).optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async update(
        args: { id: number; name?: string; expectedUpdatedAt?: string; force?: boolean },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { id, ...dto } = args
        const data = await this.workspacesService.update(id, userId, dto)
        return { ok: true, message: 'Workspace updated successfully', data }
    }

    @ToolScopes(['workspaces:write'])
    @Tool({
        name: 'workspaces_delete',
        description: 'Delete workspace',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async remove(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        await this.workspacesService.remove(args.id, userId)
        return { ok: true, message: 'Workspace deleted successfully', data: null }
    }

    @ToolScopes(['workspaces:read'])
    @Tool({
        name: 'workspaces_members_list',
        description: 'List workspace members',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async listMembers(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.workspacesService.listMembers(args.id, userId)
        return { ok: true, message: 'Workspace members fetched successfully', data }
    }

    @ToolScopes(['workspaces:write'])
    @Tool({
        name: 'workspaces_members_add',
        description: 'Add member to workspace by email',
        parameters: z.object({
            id: z.number().int().positive(),
            email: z.email()
        })
    })
    async addMember(
        args: { id: number; email: string },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.workspacesService.addMember(args.id, userId, args.email)
        return { ok: true, message: 'Member added successfully', data }
    }

    @ToolScopes(['workspaces:write'])
    @Tool({
        name: 'workspaces_members_remove',
        description: 'Remove member from workspace',
        parameters: z.object({
            id: z.number().int().positive(),
            memberUserId: z.number().int().positive()
        })
    })
    async removeMember(
        args: { id: number; memberUserId: number },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        await this.workspacesService.removeMember(args.id, userId, args.memberUserId)
        return { ok: true, message: 'Member removed successfully', data: null }
    }
}
