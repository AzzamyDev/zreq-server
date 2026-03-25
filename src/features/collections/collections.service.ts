import { Injectable, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import type { Collection as CollectionRow, User } from '@prisma/generated/client'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { WorkspacesService } from 'src/features/workspaces/workspaces.service'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'

const updatedBySelect = { id: true, name: true, email: true } as const
type EditorUser = Pick<User, 'id' | 'name' | 'email'>

export type CollectionApiRow = {
    id: number
    name: string
    items: unknown
    userId: number
    workspaceId: number
    createdAt: string
    updatedAt: string
    lastUpdatedBy?: EditorUser
}

@Injectable()
export class CollectionsService {
    constructor(
        readonly prismaService: PrismaService,
        readonly workspacesService: WorkspacesService
    ) {}

    private mapCollectionRow(
        col: CollectionRow & { updatedByUser: EditorUser | null }
    ): CollectionApiRow {
        return {
            id: col.id,
            name: col.name,
            items: col.items,
            userId: col.userId,
            workspaceId: col.workspaceId,
            createdAt: col.createdAt.toISOString(),
            updatedAt: col.updatedAt.toISOString(),
            ...(col.updatedByUser && { lastUpdatedBy: col.updatedByUser })
        }
    }

    async findAll(userId: number, workspaceId?: number): Promise<CollectionApiRow[]> {
        const accessible = await this.workspacesService.getAccessibleWorkspaceIds(userId)
        if (accessible.length === 0) return []

        const wid =
            workspaceId !== undefined && !Number.isNaN(workspaceId) ? workspaceId : undefined
        if (wid !== undefined && !accessible.includes(wid)) throw new ForbiddenException()

        const where =
            wid !== undefined ? { workspaceId: wid } : { workspaceId: { in: accessible } }

        // Narrow sort phase avoids MySQL 1038 (sort buffer) when `items` JSON is large per row.
        const ordered = await this.prismaService.collection.findMany({
            where,
            select: { id: true },
            orderBy: { createdAt: 'asc' }
        })
        const ids = ordered.map((r) => r.id)
        if (ids.length === 0) return []
        const rows = await this.prismaService.collection.findMany({
            where: { id: { in: ids } },
            include: { updatedByUser: { select: updatedBySelect } }
        })
        const byId = new Map(rows.map((r) => [r.id, r]))
        return ids.map((id) => this.mapCollectionRow(byId.get(id)!))
    }

    async findOne(id: number, userId: number): Promise<CollectionApiRow> {
        const col = await this.prismaService.collection.findUniqueOrThrow({
            where: { id },
            include: { updatedByUser: { select: updatedBySelect } }
        })
        await this.workspacesService.assertWorkspaceAccess(userId, col.workspaceId)
        return this.mapCollectionRow(col)
    }

    async create(dto: CreateCollectionDto, userId: number): Promise<CollectionApiRow> {
        let workspaceId = dto.workspaceId
        if (workspaceId == null) {
            const first = await this.prismaService.workspace.findFirst({
                where: {
                    OR: [{ userId }, { members: { some: { userId } } }]
                },
                orderBy: { id: 'asc' }
            })
            if (!first) throw new BadRequestException('No workspace — create one first')
            workspaceId = first.id
        } else {
            await this.workspacesService.assertWorkspaceAccess(userId, workspaceId)
        }
        const created = await this.prismaService.collection.create({
            data: {
                name: dto.name,
                items: dto.items ?? [],
                userId,
                workspaceId,
                updatedByUserId: userId
            },
            include: { updatedByUser: { select: updatedBySelect } }
        })
        return this.mapCollectionRow(created)
    }

    async update(id: number, dto: UpdateCollectionDto, userId: number): Promise<CollectionApiRow> {
        const col = await this.prismaService.collection.findUniqueOrThrow({ where: { id } })
        await this.workspacesService.assertWorkspaceAccess(userId, col.workspaceId)
        const raw = dto as UpdateCollectionDto & { expectedUpdatedAt?: string; force?: boolean }
        const { expectedUpdatedAt, force, name, items } = raw
        if (expectedUpdatedAt && !force) {
            if (col.updatedAt.toISOString() !== expectedUpdatedAt) {
                const fresh = await this.prismaService.collection.findUniqueOrThrow({
                    where: { id },
                    include: { updatedByUser: { select: updatedBySelect } }
                })
                throw new HttpException(
                    {
                        code: 'STALE_VERSION',
                        entity: 'collection',
                        data: this.mapCollectionRow(fresh)
                    },
                    HttpStatus.CONFLICT
                )
            }
        }
        const updated = await this.prismaService.collection.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(items !== undefined && { items }),
                updatedByUserId: userId
            },
            include: { updatedByUser: { select: updatedBySelect } }
        })
        return this.mapCollectionRow(updated)
    }

    async remove(id: number, userId: number) {
        const col = await this.prismaService.collection.findUniqueOrThrow({ where: { id } })
        await this.workspacesService.assertWorkspaceAccess(userId, col.workspaceId)
        await this.prismaService.collection.delete({ where: { id } })
    }
}
