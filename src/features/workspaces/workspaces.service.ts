import {
    Injectable,
    ForbiddenException,
    ConflictException,
    HttpException,
    HttpStatus,
    NotFoundException,
    BadRequestException
} from '@nestjs/common'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'

const memberUserSelect = { id: true, name: true, email: true } as const

export type WorkspaceMemberEntry = {
    user: { id: number; name: string; email: string }
    isOwner: boolean
}

@Injectable()
export class WorkspacesService {
    constructor(readonly prisma: PrismaService) {}

    async getAccessibleWorkspaceIds(userId: number): Promise<number[]> {
        const rows = await this.prisma.workspace.findMany({
            where: {
                OR: [{ userId }, { members: { some: { userId } } }]
            },
            select: { id: true }
        })
        return rows.map((r) => r.id)
    }

    async assertWorkspaceAccess(userId: number, workspaceId: number): Promise<void> {
        const ok = await this.prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                OR: [{ userId }, { members: { some: { userId } } }]
            },
            select: { id: true }
        })
        if (!ok) throw new ForbiddenException()
    }

    async assertWorkspaceOwner(userId: number, workspaceId: number): Promise<void> {
        const ws = await this.prisma.workspace.findFirst({
            where: { id: workspaceId, userId },
            select: { id: true }
        })
        if (!ws) throw new ForbiddenException()
    }

    async findAll(userId: number) {
        return this.prisma.workspace.findMany({
            where: {
                OR: [{ userId }, { members: { some: { userId } } }]
            },
            orderBy: { createdAt: 'asc' }
        })
    }

    async create(userId: number, dto: CreateWorkspaceDto) {
        return this.prisma.workspace.upsert({
            where: { userId_name: { userId, name: dto.name } },
            update: {},
            create: { name: dto.name, userId }
        })
    }

    async update(id: number, userId: number, dto: UpdateWorkspaceDto) {
        const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id } })
        if (ws.userId !== userId) throw new ForbiddenException()
        const raw = dto as UpdateWorkspaceDto & { expectedUpdatedAt?: string; force?: boolean }
        const { expectedUpdatedAt, force, name } = raw
        if (expectedUpdatedAt && !force) {
            if (ws.updatedAt.toISOString() !== expectedUpdatedAt) {
                throw new HttpException(
                    {
                        code: 'STALE_VERSION',
                        entity: 'workspace',
                        data: {
                            ...ws,
                            createdAt: ws.createdAt.toISOString(),
                            updatedAt: ws.updatedAt.toISOString()
                        }
                    },
                    HttpStatus.CONFLICT
                )
            }
        }
        return this.prisma.workspace.update({
            where: { id },
            data: { ...(name !== undefined && { name }) }
        })
    }

    async remove(id: number, userId: number) {
        const ws = await this.prisma.workspace.findUniqueOrThrow({
            where: { id },
            include: { _count: { select: { collections: true } } }
        })
        if (ws.userId !== userId) throw new ForbiddenException()
        if (ws._count.collections > 0) {
            throw new ConflictException('Move or delete collections before deleting this workspace')
        }
        await this.prisma.workspace.delete({ where: { id } })
    }

    async listMembers(workspaceId: number, requesterId: number): Promise<WorkspaceMemberEntry[]> {
        await this.assertWorkspaceOwner(requesterId, workspaceId)
        const ws = await this.prisma.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            include: {
                user: { select: memberUserSelect },
                members: { include: { user: { select: memberUserSelect } } }
            }
        })
        const out: WorkspaceMemberEntry[] = [
            { user: ws.user, isOwner: true },
            ...ws.members.map((m) => ({ user: m.user, isOwner: false }))
        ]
        return out
    }

    async addMember(workspaceId: number, ownerId: number, emailRaw: string) {
        await this.assertWorkspaceOwner(ownerId, workspaceId)
        const email = emailRaw.trim().toLowerCase()
        const ws = await this.prisma.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            select: { userId: true }
        })
        const target = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true }
        })
        if (!target) throw new NotFoundException('User not found')
        if (target.id === ws.userId) throw new ConflictException('User is already the workspace owner')
        const existing = await this.prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: target.id } }
        })
        if (existing) throw new ConflictException('User is already a member')
        await this.prisma.workspaceMember.create({
            data: { workspaceId, userId: target.id }
        })
        return { user: target, isOwner: false as const }
    }

    async removeMember(workspaceId: number, ownerId: number, memberUserId: number) {
        await this.assertWorkspaceOwner(ownerId, workspaceId)
        const ws = await this.prisma.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            select: { userId: true }
        })
        if (memberUserId === ws.userId) {
            throw new BadRequestException('Cannot remove the workspace owner')
        }
        const res = await this.prisma.workspaceMember.deleteMany({
            where: { workspaceId, userId: memberUserId }
        })
        if (res.count === 0) throw new NotFoundException('Member not found')
    }
}
