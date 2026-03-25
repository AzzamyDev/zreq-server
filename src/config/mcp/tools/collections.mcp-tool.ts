import { BadRequestException, Injectable } from '@nestjs/common'
import { Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { CollectionsService } from 'src/features/collections/collections.service'
import { McpIdentityService } from '../mcp-identity.service'

type NormalizedCollectionItem = {
    id: string
    type: 'folder' | 'request'
    name: string
    items?: NormalizedCollectionItem[]
    method?: string
    url?: string
    headers?: unknown[]
    params?: unknown[]
    body?: { type: string; content: string }
    auth?: Record<string, unknown>
    scripts?: { preRequest?: string; postResponse?: string }
}

type CollectionFolderItem = {
    id: string
    type: 'folder'
    name: string
    items: CollectionTreeItem[]
}

type CollectionRequestItem = {
    id: string
    type: 'request'
    name: string
    method: string
    url: string
    headers?: unknown[]
    params?: unknown[]
    body?: { type: string; content: string }
    auth?: Record<string, unknown>
    scripts?: { preRequest?: string; postResponse?: string }
}

type CollectionTreeItem = CollectionFolderItem | CollectionRequestItem

@Injectable()
export class CollectionsMcpTool {
    constructor(
        private readonly collectionsService: CollectionsService,
        private readonly identityService: McpIdentityService
    ) {}

    private toItemId = (name: string, idx: number) =>
        `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'}-${idx}`

    private normalizeItems(items: unknown[] | undefined): unknown[] | undefined {
        if (!Array.isArray(items)) return items

        const normalize = (item: any, idx: number): NormalizedCollectionItem => {
            const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : `Item ${idx + 1}`
            const id = typeof item?.id === 'string' && item.id.trim() ? item.id : this.toItemId(name, idx)

            if (item?.type === 'folder' || Array.isArray(item?.items)) {
                const childItems = Array.isArray(item?.items) ? item.items : []
                return {
                    id,
                    type: 'folder',
                    name,
                    items: childItems.map((child: unknown, childIdx: number) => normalize(child, childIdx))
                }
            }

            const requestMethod =
                typeof item?.method === 'string'
                    ? item.method
                    : typeof item?.request?.method === 'string'
                      ? item.request.method
                      : 'GET'

            const requestUrl =
                typeof item?.url === 'string'
                    ? item.url
                    : typeof item?.request?.url === 'string'
                      ? item.request.url
                      : ''

            return {
                id,
                type: 'request',
                name,
                method: requestMethod.toUpperCase(),
                url: requestUrl,
                headers: Array.isArray(item?.headers) ? item.headers : [],
                params: Array.isArray(item?.params) ? item.params : [],
                body:
                    item?.body && typeof item.body === 'object'
                        ? { type: item.body.type || 'none', content: item.body.content || '' }
                        : { type: 'none', content: '' },
                auth:
                    item?.auth && typeof item.auth === 'object'
                        ? item.auth
                        : { type: 'none' },
                scripts:
                    item?.scripts && typeof item.scripts === 'object'
                        ? {
                              preRequest:
                                  typeof item.scripts.preRequest === 'string'
                                      ? item.scripts.preRequest
                                      : undefined,
                              postResponse:
                                  typeof item.scripts.postResponse === 'string'
                                      ? item.scripts.postResponse
                                      : undefined
                          }
                        : undefined
            }
        }

        return items.map((item, idx) => normalize(item, idx))
    }

    private insertFolder(
        items: CollectionTreeItem[],
        parentFolderId: string | undefined,
        folder: CollectionFolderItem
    ): { items: CollectionTreeItem[]; inserted: boolean } {
        if (!parentFolderId) return { items: [...items, folder], inserted: true }

        let inserted = false
        const next = items.map((item) => {
            if (item.type !== 'folder') return item

            if (item.id === parentFolderId) {
                inserted = true
                return { ...item, items: [...item.items, folder] }
            }

            const nested = this.insertFolder(item.items, parentFolderId, folder)
            if (nested.inserted) {
                inserted = true
                return { ...item, items: nested.items }
            }

            return item
        })

        return { items: next, inserted }
    }

    private buildRequestItem(args: {
        requestName: string
        requestId?: string
        method: string
        url: string
        headers?: unknown[]
        params?: unknown[]
        body?: { type: string; content: string }
        auth?: Record<string, unknown>
        preRequest?: string
        postResponse?: string
    }): CollectionRequestItem {
        return {
            id: args.requestId?.trim() || this.toItemId(args.requestName, Date.now()),
            type: 'request',
            name: args.requestName.trim(),
            method: args.method.toUpperCase(),
            url: args.url,
            headers: Array.isArray(args.headers) ? args.headers : [],
            params: Array.isArray(args.params) ? args.params : [],
            body: args.body ?? { type: 'none', content: '' },
            auth: args.auth ?? { type: 'none' },
            scripts: {
                ...(args.preRequest !== undefined && { preRequest: args.preRequest }),
                ...(args.postResponse !== undefined && { postResponse: args.postResponse })
            }
        }
    }

    private insertRequest(
        items: CollectionTreeItem[],
        parentFolderId: string | undefined,
        requestItem: CollectionRequestItem
    ): { items: CollectionTreeItem[]; inserted: boolean } {
        if (!parentFolderId) return { items: [...items, requestItem], inserted: true }

        let inserted = false
        const next = items.map((item) => {
            if (item.type !== 'folder') return item

            if (item.id === parentFolderId) {
                inserted = true
                return { ...item, items: [...item.items, requestItem] }
            }

            const nested = this.insertRequest(item.items, parentFolderId, requestItem)
            if (nested.inserted) {
                inserted = true
                return { ...item, items: nested.items }
            }

            return item
        })

        return { items: next, inserted }
    }

    private updateRequestById(
        items: CollectionTreeItem[],
        requestId: string,
        updater: (current: CollectionRequestItem) => CollectionRequestItem
    ): { items: CollectionTreeItem[]; updated: boolean } {
        let updated = false
        const next = items.map((item) => {
            if (item.type === 'request') {
                if (item.id !== requestId) return item
                updated = true
                return updater(item)
            }

            const nested = this.updateRequestById(item.items, requestId, updater)
            if (nested.updated) {
                updated = true
                return { ...item, items: nested.items }
            }

            return item
        })

        return { items: next, updated }
    }

    @ToolScopes(['collections:read'])
    @Tool({
        name: 'collections_list',
        description: 'List collections the user can access',
        parameters: z.object({
            workspaceId: z.number().int().positive().optional()
        })
    })
    async list(
        args: { workspaceId?: number },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.collectionsService.findAll(userId, args.workspaceId)
        return { ok: true, message: 'Collections fetched successfully', data }
    }

    @ToolScopes(['collections:read'])
    @Tool({
        name: 'collections_get',
        description: 'Get collection by id',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async get(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.collectionsService.findOne(args.id, userId)
        return { ok: true, message: 'Collection fetched successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_create',
        description: 'Create collection',
        parameters: z.object({
            name: z.string().min(1),
            items: z.array(z.any()).optional(),
            workspaceId: z.number().int().positive().optional()
        })
    })
    async create(
        args: { name: string; items?: unknown[]; workspaceId?: number },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const data = await this.collectionsService.create(
            { ...args, items: this.normalizeItems(args.items) },
            userId
        )
        return { ok: true, message: 'Collection created successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_update',
        description: 'Update collection',
        parameters: z.object({
            id: z.number().int().positive(),
            name: z.string().min(1).optional(),
            items: z.array(z.any()).optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async update(
        args: {
            id: number
            name?: string
            items?: unknown[]
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { id, ...dto } = args
        const data = await this.collectionsService.update(
            id,
            { ...dto, items: this.normalizeItems(dto.items) },
            userId
        )
        return { ok: true, message: 'Collection updated successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_add_folder',
        description: 'Add a folder to collection root or to a parent folder',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            folderName: z.string().min(1),
            folderId: z.string().min(1).optional(),
            parentFolderId: z.string().min(1).optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async addFolder(
        args: {
            collectionId: number
            folderName: string
            folderId?: string
            parentFolderId?: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const collection = await this.collectionsService.findOne(args.collectionId, userId)
        const normalizedItems = (this.normalizeItems(
            Array.isArray(collection.items) ? collection.items : []
        ) ?? []) as CollectionTreeItem[]

        const nextFolder: CollectionFolderItem = {
            id: args.folderId?.trim() || this.toItemId(args.folderName, normalizedItems.length),
            type: 'folder',
            name: args.folderName.trim(),
            items: []
        }

        const { items, inserted } = this.insertFolder(
            normalizedItems,
            args.parentFolderId,
            nextFolder
        )
        if (!inserted) {
            throw new BadRequestException(`Parent folder not found: ${args.parentFolderId}`)
        }

        const data = await this.collectionsService.update(
            args.collectionId,
            {
                items,
                expectedUpdatedAt: args.expectedUpdatedAt,
                force: args.force
            },
            userId
        )

        return {
            ok: true,
            message: 'Folder added successfully',
            data
        }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_add_request',
        description:
            'Add request to collection root or inside folder with params, headers, body, auth, and scripts',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            requestName: z.string().min(1),
            requestId: z.string().min(1).optional(),
            parentFolderId: z.string().min(1).optional(),
            method: z.string().min(1),
            url: z.string().min(1),
            headers: z.array(z.any()).optional(),
            params: z.array(z.any()).optional(),
            body: z
                .object({
                    type: z.string().min(1),
                    content: z.string()
                })
                .optional(),
            auth: z.record(z.string(), z.unknown()).optional(),
            preRequest: z.string().optional(),
            postResponse: z.string().optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async addRequest(
        args: {
            collectionId: number
            requestName: string
            requestId?: string
            parentFolderId?: string
            method: string
            url: string
            headers?: unknown[]
            params?: unknown[]
            body?: { type: string; content: string }
            auth?: Record<string, unknown>
            preRequest?: string
            postResponse?: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const collection = await this.collectionsService.findOne(args.collectionId, userId)
        const normalizedItems = (this.normalizeItems(
            Array.isArray(collection.items) ? collection.items : []
        ) ?? []) as CollectionTreeItem[]

        const nextRequest = this.buildRequestItem(args)
        const { items, inserted } = this.insertRequest(normalizedItems, args.parentFolderId, nextRequest)
        if (!inserted) {
            throw new BadRequestException(`Parent folder not found: ${args.parentFolderId}`)
        }

        const data = await this.collectionsService.update(
            args.collectionId,
            {
                items,
                expectedUpdatedAt: args.expectedUpdatedAt,
                force: args.force
            },
            userId
        )

        return { ok: true, message: 'Request added successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_update_request',
        description:
            'Update request in collection including params, headers, body, auth, preRequest, and postResponse',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            requestId: z.string().min(1),
            requestName: z.string().min(1).optional(),
            method: z.string().min(1).optional(),
            url: z.string().min(1).optional(),
            headers: z.array(z.any()).optional(),
            params: z.array(z.any()).optional(),
            body: z
                .object({
                    type: z.string().min(1),
                    content: z.string()
                })
                .optional(),
            auth: z.record(z.string(), z.unknown()).optional(),
            preRequest: z.string().optional(),
            postResponse: z.string().optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async updateRequest(
        args: {
            collectionId: number
            requestId: string
            requestName?: string
            method?: string
            url?: string
            headers?: unknown[]
            params?: unknown[]
            body?: { type: string; content: string }
            auth?: Record<string, unknown>
            preRequest?: string
            postResponse?: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const collection = await this.collectionsService.findOne(args.collectionId, userId)
        const normalizedItems = (this.normalizeItems(
            Array.isArray(collection.items) ? collection.items : []
        ) ?? []) as CollectionTreeItem[]

        const { items, updated } = this.updateRequestById(normalizedItems, args.requestId, (current) => ({
            ...current,
            ...(args.requestName !== undefined && { name: args.requestName.trim() }),
            ...(args.method !== undefined && { method: args.method.toUpperCase() }),
            ...(args.url !== undefined && { url: args.url }),
            ...(args.headers !== undefined && { headers: args.headers }),
            ...(args.params !== undefined && { params: args.params }),
            ...(args.body !== undefined && { body: args.body }),
            ...(args.auth !== undefined && { auth: args.auth }),
            scripts: {
                ...(current.scripts ?? {}),
                ...(args.preRequest !== undefined && { preRequest: args.preRequest }),
                ...(args.postResponse !== undefined && { postResponse: args.postResponse })
            }
        }))

        if (!updated) {
            throw new BadRequestException(`Request not found: ${args.requestId}`)
        }

        const data = await this.collectionsService.update(
            args.collectionId,
            {
                items,
                expectedUpdatedAt: args.expectedUpdatedAt,
                force: args.force
            },
            userId
        )

        return { ok: true, message: 'Request updated successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_delete',
        description: 'Delete collection',
        parameters: z.object({ id: z.number().int().positive() })
    })
    async remove(args: { id: number }, _context: unknown, req?: McpRequestWithUser) {
        const userId = await this.identityService.resolveUserId(req)
        await this.collectionsService.remove(args.id, userId)
        return { ok: true, message: 'Collection deleted successfully', data: null }
    }
}
