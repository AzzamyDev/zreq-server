import { Injectable, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/generated/client'
import type { Collection as CollectionRow, CollectionRequest as CollectionRequestRow, User } from '@prisma/generated/client'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { WorkspacesService } from 'src/features/workspaces/workspaces.service'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'

const updatedBySelect = { id: true, name: true, email: true } as const
type EditorUser = Pick<User, 'id' | 'name' | 'email'>

export type CollectionApiRow = {
    id: number
    name: string
    description: string | null
    auth: unknown
    variables: unknown
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
    ) { }

    private isRecord(v: unknown): v is Record<string, unknown> {
        return typeof v === 'object' && v !== null
    }

    private asStringArrayJson(value: Prisma.JsonValue | null | undefined): unknown[] {
        if (value == null) return []
        if (Array.isArray(value)) return value
        return []
    }

    private toBody(body: unknown): { type: string; content: string } {
        if (!this.isRecord(body)) return { type: 'none', content: '' }
        const type = typeof body.type === 'string' ? body.type : 'none'
        const content = typeof body.content === 'string' ? body.content : ''
        return { type, content }
    }

    private toAuth(auth: unknown): Record<string, unknown> {
        if (!this.isRecord(auth)) return { type: 'none' }
        return auth
    }

    private toScriptsRow(req: CollectionRequestRow): { preRequest?: string; postResponse?: string } | undefined {
        const fromCols = {
            ...(req.preRequest ? { preRequest: req.preRequest } : {}),
            ...(req.postResponse ? { postResponse: req.postResponse } : {})
        }
        if (req.scripts == null || !this.isRecord(req.scripts)) {
            return Object.keys(fromCols).length ? fromCols : undefined
        }
        const pre =
            typeof req.scripts.preRequest === 'string' ? req.scripts.preRequest : fromCols.preRequest
        const post =
            typeof req.scripts.postResponse === 'string' ? req.scripts.postResponse : fromCols.postResponse
        const merged = {
            ...(pre ? { preRequest: pre } : {}),
            ...(post ? { postResponse: post } : {})
        }
        return Object.keys(merged).length ? merged : undefined
    }

    private mapRequestToItem(req: CollectionRequestRow): Record<string, unknown> {
        return {
            id: req.clientItemId?.trim() ? req.clientItemId.trim() : String(req.id),
            type: 'request',
            name: req.name,
            method: req.method,
            url: req.url ?? '',
            headers: this.asStringArrayJson(req.headers),
            params: this.asStringArrayJson(req.params),
            body: this.toBody(req.body),
            auth: this.toAuth(req.auth),
            ...(this.toScriptsRow(req) ? { scripts: this.toScriptsRow(req) } : {})
        }
    }

    private async loadSubtreeMaps(rootId: number): Promise<{
        folderById: Map<number, CollectionRow>
        childrenFolders: Map<number, CollectionRow[]>
        folderRequests: Map<number, CollectionRequestRow[]>
    }> {
        const folderById = new Map<number, CollectionRow>()
        const childrenFolders = new Map<number, CollectionRow[]>()
        const folderRequests = new Map<number, CollectionRequestRow[]>()

        const root = await this.prismaService.collection.findUniqueOrThrow({ where: { id: rootId } })
        folderById.set(root.id, root)

        let frontier = [rootId]
        while (frontier.length > 0) {
            const children = await this.prismaService.collection.findMany({
                where: { parentId: { in: frontier } },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
            })
            for (const c of children) {
                folderById.set(c.id, c)
                const list = childrenFolders.get(c.parentId!) ?? []
                list.push(c)
                childrenFolders.set(c.parentId!, list)
            }
            frontier = children.map((c) => c.id)
        }

        const folderIds = [...folderById.keys()]
        const requests = await this.prismaService.collectionRequest.findMany({
            where: { folderId: { in: folderIds } },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        })
        for (const r of requests) {
            const list = folderRequests.get(r.folderId) ?? []
            list.push(r)
            folderRequests.set(r.folderId, list)
        }

        return { folderById, childrenFolders, folderRequests }
    }

    private mergeFolderItems(
        folderId: number,
        maps: {
            childrenFolders: Map<number, CollectionRow[]>
            folderRequests: Map<number, CollectionRequestRow[]>
        }
    ): unknown[] {
        const folders = maps.childrenFolders.get(folderId) ?? []
        const requests = maps.folderRequests.get(folderId) ?? []
        const merged: Array<
            | { kind: 'folder'; sortOrder: number; folder: CollectionRow }
            | { kind: 'request'; sortOrder: number; request: CollectionRequestRow }
        > = [
                ...folders.map((f) => ({ kind: 'folder' as const, sortOrder: f.sortOrder, folder: f })),
                ...requests.map((r) => ({ kind: 'request' as const, sortOrder: r.sortOrder, request: r }))
            ]
        merged.sort((a, b) => {
            const byOrder = a.sortOrder - b.sortOrder
            if (byOrder !== 0) return byOrder
            if (a.kind === 'request' && b.kind === 'request') return a.request.id - b.request.id
            if (a.kind === 'folder' && b.kind === 'folder') return a.folder.id - b.folder.id
            return a.kind === 'folder' ? -1 : 1
        })

        return merged.map((e) => {
            if (e.kind === 'request') return this.mapRequestToItem(e.request)
            const f = e.folder
            return {
                id: f.clientFolderId?.trim() ? f.clientFolderId.trim() : String(f.id),
                type: 'folder',
                name: f.name,
                ...(f.description != null ? { description: f.description } : {}),
                ...(f.auth != null ? { auth: f.auth } : {}),
                ...(f.variables != null ? { variables: f.variables } : {}),
                items: this.mergeFolderItems(f.id, maps)
            }
        })
    }

    private async buildItemsPayload(rootId: number): Promise<unknown[]> {
        const maps = await this.loadSubtreeMaps(rootId)
        return this.mergeFolderItems(rootId, maps)
    }

    private isFolderishItem(item: unknown): boolean {
        if (!this.isRecord(item)) return false
        if (item.type === 'folder') return true
        return Array.isArray(item.items)
    }

    private isRequestishItem(item: unknown): boolean {
        if (!this.isRecord(item)) return false
        if (item.type === 'request') return true
        return typeof item.method === 'string' || this.isRecord(item.request)
    }

    private async persistItemsTree(
        tx: Prisma.TransactionClient,
        args: {
            root: CollectionRow
            userId: number
            items: unknown[] | undefined
        }
    ) {
        const items = Array.isArray(args.items) ? args.items : []

        const descendantIds = await tx.collection.findMany({
            where: { parentId: args.root.id },
            select: { id: true }
        })
        const queue = descendantIds.map((r) => r.id)
        const toDelete: number[] = []
        while (queue.length > 0) {
            const id = queue.pop()!
            toDelete.push(id)
            const kids = await tx.collection.findMany({ where: { parentId: id }, select: { id: true } })
            for (const k of kids) queue.push(k.id)
        }
        toDelete.sort((a, b) => b - a)
        for (const id of toDelete) {
            await tx.collection.delete({ where: { id } })
        }

        const walk = async (parentFolderId: number, nodes: unknown[]) => {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i]
                if (this.isFolderishItem(node)) {
                    const n = node as Record<string, unknown>
                    const name =
                        typeof n.name === 'string' && n.name.trim() ? n.name.trim() : `Folder ${i + 1}`
                    const clientFolderId =
                        typeof n.id === 'string' && n.id.trim() ? n.id.trim().slice(0, 191) : null
                    const folderDescription =
                        typeof n.description === 'string' ? n.description : null
                    const folderAuth = this.isRecord(n.auth) ? (n.auth as Prisma.InputJsonValue) : Prisma.JsonNull
                    const folderVariables = Array.isArray(n.variables) ? (n.variables as Prisma.InputJsonValue) : Prisma.JsonNull
                    const folder = await tx.collection.create({
                        data: {
                            parentId: parentFolderId,
                            sortOrder: i,
                            workspaceId: args.root.workspaceId,
                            userId: args.root.userId,
                            name,
                            description: folderDescription,
                            auth: folderAuth,
                            variables: folderVariables,
                            ...(clientFolderId ? { clientFolderId } : {}),
                            updatedByUserId: args.userId
                        }
                    })
                    const childItems = Array.isArray(n.items) ? (n.items as unknown[]) : []
                    await walk(folder.id, childItems)
                    continue
                }

                if (this.isRequestishItem(node)) {
                    const n = node as Record<string, unknown>
                    const name =
                        typeof n.name === 'string' && n.name.trim() ? n.name.trim() : `Request ${i + 1}`
                    const methodRaw =
                        typeof n.method === 'string'
                            ? n.method
                            : this.isRecord(n.request) && typeof n.request.method === 'string'
                                ? n.request.method
                                : 'GET'
                    const urlRaw =
                        typeof n.url === 'string'
                            ? n.url
                            : this.isRecord(n.request) && typeof n.request.url === 'string'
                                ? n.request.url
                                : ''
                    const headers = (Array.isArray(n.headers) ? n.headers : []) as Prisma.InputJsonValue
                    const params = (Array.isArray(n.params) ? n.params : []) as Prisma.InputJsonValue
                    const body = (
                        this.isRecord(n.body) ? n.body : { type: 'none', content: '' }
                    ) as Prisma.InputJsonValue
                    const auth = (this.isRecord(n.auth) ? n.auth : { type: 'none' }) as Prisma.InputJsonValue
                    const scriptsObj = this.isRecord(n.scripts) ? n.scripts : undefined
                    const scriptsJson = scriptsObj ? (scriptsObj as Prisma.InputJsonValue) : undefined
                    const preRequest =
                        typeof n.preRequest === 'string'
                            ? n.preRequest
                            : scriptsObj && typeof scriptsObj.preRequest === 'string'
                                ? scriptsObj.preRequest
                                : null
                    const postResponse =
                        typeof n.postResponse === 'string'
                            ? n.postResponse
                            : scriptsObj && typeof scriptsObj.postResponse === 'string'
                                ? scriptsObj.postResponse
                                : null
                    const clientItemId =
                        typeof n.id === 'string' && n.id.trim() ? n.id.trim().slice(0, 191) : null

                    await tx.collectionRequest.create({
                        data: {
                            folderId: parentFolderId,
                            ...(clientItemId ? { clientItemId } : {}),
                            sortOrder: i,
                            name,
                            method: methodRaw.toUpperCase(),
                            url: urlRaw,
                            headers,
                            params,
                            body,
                            auth,
                            scripts: scriptsJson ?? Prisma.JsonNull,
                            preRequest,
                            postResponse
                        }
                    })
                    continue
                }
            }
        }

        await walk(args.root.id, items)
    }

    private async mapCollectionRow(
        col: CollectionRow & { updatedByUser: EditorUser | null }
    ): Promise<CollectionApiRow> {
        return {
            id: col.id,
            name: col.name,
            description: col.description ?? null,
            auth: col.auth ?? null,
            variables: col.variables ?? null,
            items: await this.buildItemsPayload(col.id),
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
            wid !== undefined
                ? { workspaceId: wid, parentId: null }
                : { workspaceId: { in: accessible }, parentId: null }

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
        return Promise.all(ids.map((id) => this.mapCollectionRow(byId.get(id)!)))
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
        const created = await this.prismaService.$transaction(async (tx) => {
            const root = await tx.collection.create({
                data: {
                    parentId: null,
                    sortOrder: 0,
                    name: dto.name,
                    description: dto.description ?? null,
                    auth: dto.auth ? (dto.auth as Prisma.InputJsonValue) : Prisma.JsonNull,
                    variables: dto.variables ? (dto.variables as Prisma.InputJsonValue) : Prisma.JsonNull,
                    userId,
                    workspaceId,
                    updatedByUserId: userId
                }
            })
            await this.persistItemsTree(tx, { root, userId, items: dto.items ?? [] })
            return tx.collection.findUniqueOrThrow({
                where: { id: root.id },
                include: { updatedByUser: { select: updatedBySelect } }
            })
        })
        return this.mapCollectionRow(created)
    }

    async update(id: number, dto: UpdateCollectionDto, userId: number): Promise<CollectionApiRow> {
        const col = await this.prismaService.collection.findUniqueOrThrow({ where: { id } })
        await this.workspacesService.assertWorkspaceAccess(userId, col.workspaceId)
        const raw = dto as UpdateCollectionDto & { expectedUpdatedAt?: string; force?: boolean; description?: string; auth?: Record<string, unknown>; variables?: unknown[] }
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
                        data: await this.mapCollectionRow(fresh)
                    },
                    HttpStatus.CONFLICT
                )
            }
        }
        const { description, auth, variables } = raw
        const updated = await this.prismaService.$transaction(async (tx) => {
            const next = await tx.collection.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(description !== undefined && { description }),
                    ...(auth !== undefined && { auth: auth as Prisma.InputJsonValue }),
                    ...(variables !== undefined && { variables: variables as Prisma.InputJsonValue }),
                    updatedByUserId: userId
                }
            })
            if (items !== undefined) {
                await this.persistItemsTree(tx, { root: next, userId, items })
            }
            return tx.collection.findUniqueOrThrow({
                where: { id },
                include: { updatedByUser: { select: updatedBySelect } }
            })
        })
        return this.mapCollectionRow(updated)
    }

    async remove(id: number, userId: number) {
        const col = await this.prismaService.collection.findUniqueOrThrow({ where: { id } })
        await this.workspacesService.assertWorkspaceAccess(userId, col.workspaceId)
        await this.prismaService.collection.delete({ where: { id } })
    }
}
