import { Injectable } from '@nestjs/common'
import { Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { EnvironmentsService } from 'src/features/environments/environments.service'
import type { UpdateEnvironmentDto } from 'src/features/environments/dto/update-environment.dto'
import { McpIdentityService } from '../mcp-identity.service'

const envVarSchema = z.object({
    key: z.string().min(1),
    value: z.string(),
    enabled: z.boolean().optional()
})

@Injectable()
export class EnvironmentsMcpTool {
    constructor(
        private readonly environmentsService: EnvironmentsService,
        private readonly identityService: McpIdentityService
    ) {}

    @ToolScopes(['environments:read'])
    @Tool({
        name: 'environments_list',
        description: 'List environments in a workspace (or all accessible workspaces if workspaceId omitted)',
        parameters: z.object({
            workspaceId: z.number().int().positive().optional()
        })
    })
    async list(args: { workspaceId?: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.environmentsService.findAll(userId, args.workspaceId)
        return { ok: true, message: 'Environments fetched successfully', data }
    }

    @ToolScopes(['environments:read'])
    @Tool({
        name: 'environments_get',
        description: 'Get environment by id',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async get(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.environmentsService.findOne(args.id, userId)
        return { ok: true, message: 'Environment fetched successfully', data }
    }

    @ToolScopes(['environments:write'])
    @Tool({
        name: 'environments_create',
        description: 'Create environment in a workspace',
        parameters: z.object({
            workspaceId: z.number().int().positive(),
            name: z.string().min(1),
            variables: z.array(envVarSchema).optional()
        })
    })
    async create(
        args: {
            workspaceId: number
            name: string
            variables?: Array<{ key: string; value: string; enabled?: boolean }>
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.environmentsService.create(
            {
                workspaceId: args.workspaceId,
                name: args.name,
                variables: (args.variables ?? []).map((v) => ({
                    key: v.key,
                    value: v.value,
                    enabled: v.enabled ?? true
                }))
            },
            userId
        )
        return { ok: true, message: 'Environment created successfully', data }
    }

    @ToolScopes(['environments:write'])
    @Tool({
        name: 'environments_update',
        description: 'Update environment and replace its variables when provided',
        parameters: z.object({
            id: z.number().int().positive(),
            name: z.string().min(1).optional(),
            variables: z.array(envVarSchema).optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async update(
        args: {
            id: number
            name?: string
            variables?: Array<{ key: string; value: string; enabled?: boolean }>
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { id, ...dto } = args
        const updatePayload: UpdateEnvironmentDto = {}
        if (dto.name !== undefined) updatePayload.name = dto.name
        if (dto.expectedUpdatedAt !== undefined) updatePayload.expectedUpdatedAt = dto.expectedUpdatedAt
        if (dto.force !== undefined) updatePayload.force = dto.force
        if (dto.variables !== undefined) {
            updatePayload.variables = dto.variables.map((v) => ({
                key: v.key,
                value: v.value,
                enabled: v.enabled ?? true
            }))
        }
        const data = await this.environmentsService.update(
            id,
            updatePayload,
            userId
        )
        return { ok: true, message: 'Environment updated successfully', data }
    }

    @ToolScopes(['environments:write'])
    @Tool({
        name: 'environments_delete',
        description: 'Delete environment',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async remove(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        await this.environmentsService.remove(args.id, userId)
        return { ok: true, message: 'Environment deleted successfully', data: null }
    }
}
