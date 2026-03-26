import { Injectable, ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import type { Environment, EnvironmentVariable, User } from '@prisma/generated/client'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { CreateEnvironmentDto } from './dto/create-environment.dto'
import { UpdateEnvironmentDto } from './dto/update-environment.dto'

const updatedBySelect = { id: true, name: true, email: true } as const
type EditorUser = Pick<User, 'id' | 'name' | 'email'>

export type EnvironmentApiRow = {
    id: number
    name: string
    userId: number
    createdAt: string
    updatedAt: string
    lastUpdatedBy?: EditorUser
    variables: Array<{
        id: number
        environmentId: number
        key: string
        value: string
        enabled: boolean
        createdAt: string
        updatedAt: string
        lastUpdatedBy?: EditorUser
    }>
}

type EnvWithRelations = Environment & {
    updatedByUser: EditorUser | null
    variables: (EnvironmentVariable & { updatedByUser: EditorUser | null })[]
}

@Injectable()
export class EnvironmentsService {
    constructor(readonly prismaService: PrismaService) {}

    private mapEnvironmentRow(row: EnvWithRelations): EnvironmentApiRow {
        return {
            id: row.id,
            name: row.name,
            userId: row.userId,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            ...(row.updatedByUser && { lastUpdatedBy: row.updatedByUser }),
            variables: row.variables.map((v) => ({
                id: v.id,
                environmentId: v.environmentId,
                key: v.key,
                value: v.value,
                enabled: v.enabled,
                createdAt: v.createdAt.toISOString(),
                updatedAt: v.updatedAt.toISOString(),
                ...(v.updatedByUser && { lastUpdatedBy: v.updatedByUser })
            }))
        }
    }

    private envInclude() {
        return {
            updatedByUser: { select: updatedBySelect },
            variables: { include: { updatedByUser: { select: updatedBySelect } } }
        } as const
    }

    async findAll(userId: number): Promise<EnvironmentApiRow[]> {
        const ordered = await this.prismaService.environment.findMany({
            where: { userId },
            select: { id: true },
            orderBy: { createdAt: 'asc' }
        })
        const ids = ordered.map((r) => r.id)
        if (ids.length === 0) return []
        const rows = await this.prismaService.environment.findMany({
            where: { id: { in: ids } },
            include: this.envInclude()
        })
        const byId = new Map(rows.map((r) => [r.id, r]))
        return ids.map((id) => this.mapEnvironmentRow(byId.get(id)! as EnvWithRelations))
    }

    async findOne(id: number, userId: number): Promise<EnvironmentApiRow> {
        const env = await this.prismaService.environment.findUniqueOrThrow({
            where: { id },
            include: this.envInclude()
        })
        if (env.userId !== userId) throw new ForbiddenException()
        return this.mapEnvironmentRow(env as EnvWithRelations)
    }

    async create(dto: CreateEnvironmentDto, userId: number): Promise<EnvironmentApiRow> {
        const userExists = await this.prismaService.user.findUnique({
            where: { id: userId },
            select: { id: true }
        })
        if (!userExists) throw new UnauthorizedException('Invalid user for this token')

        const created = await this.prismaService.environment.create({
            data: {
                name: dto.name,
                userId,
                updatedByUserId: userId,
                variables: {
                    create: (dto.variables ?? []).map((v) => ({
                        key: v.key,
                        value: v.value,
                        enabled: v.enabled ?? true,
                        updatedByUserId: userId
                    }))
                }
            },
            include: this.envInclude()
        })
        return this.mapEnvironmentRow(created as EnvWithRelations)
    }

    async update(id: number, dto: UpdateEnvironmentDto, userId: number) {
        const env = await this.prismaService.environment.findUniqueOrThrow({ where: { id } })
        if (env.userId !== userId) throw new ForbiddenException()
        const raw = dto as UpdateEnvironmentDto & { expectedUpdatedAt?: string; force?: boolean }
        const { expectedUpdatedAt, force, name, variables } = raw
        if (expectedUpdatedAt && !force) {
            const expectedMs = Date.parse(expectedUpdatedAt)
            const serverMs = env.updatedAt.getTime()
            const stale = !Number.isFinite(expectedMs) || serverMs !== expectedMs
            if (stale) {
                const full = await this.prismaService.environment.findUniqueOrThrow({
                    where: { id },
                    include: this.envInclude()
                })
                const data = this.mapEnvironmentRow(full as EnvWithRelations)
                throw new HttpException(
                    {
                        code: 'STALE_VERSION',
                        entity: 'environment',
                        data
                    },
                    HttpStatus.CONFLICT
                )
            }
        }

        if (variables !== undefined) {
            await this.prismaService.environmentVariable.deleteMany({
                where: { environmentId: id }
            })
        }

        const updated = await this.prismaService.environment.update({
            where: { id },
            data: {
                updatedByUserId: userId,
                ...(name !== undefined && { name }),
                ...(variables !== undefined && {
                    variables: {
                        create: variables.map((v) => ({
                            key: v.key,
                            value: v.value,
                            enabled: v.enabled ?? true,
                            updatedByUserId: userId
                        }))
                    }
                })
            },
            include: this.envInclude()
        })
        return this.mapEnvironmentRow(updated as EnvWithRelations)
    }

    async remove(id: number, userId: number) {
        const env = await this.prismaService.environment.findUniqueOrThrow({ where: { id } })
        if (env.userId !== userId) throw new ForbiddenException()
        await this.prismaService.environment.delete({ where: { id } })
    }
}
