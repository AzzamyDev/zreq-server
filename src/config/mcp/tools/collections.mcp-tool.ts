import { BadRequestException, Injectable } from '@nestjs/common'
import { Tool, ToolScopes } from '@rekog/mcp-nest'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { CollectionsService } from 'src/features/collections/collections.service'
import { McpIdentityService } from '../mcp-identity.service'

type NormalizedKvRow = {
    id: string
    key: string
    value: string
    enabled: boolean
}

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
    protocol?: 'http' | 'ws'
    subprotocols?: string
    savedMessages?: unknown[]
    messageTemplate?: string
    savedResponses?: unknown[]
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
    protocol?: 'http' | 'ws'
    subprotocols?: string
    savedMessages?: unknown[]
    messageTemplate?: string
    savedResponses?: unknown[]
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

    /** Ensure each header/param row has id, key, value, and enabled (default true). */
    private normalizeKvRows(rows: unknown[] | undefined): NormalizedKvRow[] {
        if (!Array.isArray(rows)) return []
        return rows.map((row) => {
            const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
            const disabled = r.disabled === true
            const enabled = typeof r.enabled === 'boolean' ? r.enabled : !disabled
            return {
                id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : uuid(),
                key: typeof r.key === 'string' ? r.key : '',
                value: r.value == null ? '' : String(r.value),
                enabled
            }
        })
    }

    private resolveProtocol(protocol: unknown, url: string): 'http' | 'ws' {
        if (protocol === 'ws' || protocol === 'http') return protocol
        return /^wss?:\/\//i.test(url) ? 'ws' : 'http'
    }

    private normalizeScripts(
        item: Record<string, unknown> | null | undefined
    ): { preRequest?: string; postResponse?: string } | undefined {
        if (!item || typeof item !== 'object') return undefined
        const nested =
            item.scripts && typeof item.scripts === 'object'
                ? (item.scripts as Record<string, unknown>)
                : undefined
        const preRequest =
            typeof item.preRequest === 'string'
                ? item.preRequest
                : typeof nested?.preRequest === 'string'
                  ? nested.preRequest
                  : undefined
        const postResponse =
            typeof item.postResponse === 'string'
                ? item.postResponse
                : typeof nested?.postResponse === 'string'
                  ? nested.postResponse
                  : undefined
        if (preRequest === undefined && postResponse === undefined) return undefined
        return {
            ...(preRequest !== undefined && { preRequest }),
            ...(postResponse !== undefined && { postResponse })
        }
    }

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

            const protocol = this.resolveProtocol(item?.protocol, requestUrl)
            const subprotocols =
                typeof item?.subprotocols === 'string' ? item.subprotocols : undefined
            const savedMessages = Array.isArray(item?.savedMessages) ? item.savedMessages : undefined
            const messageTemplate =
                typeof item?.messageTemplate === 'string' ? item.messageTemplate : undefined
            const savedResponses = Array.isArray(item?.savedResponses) ? item.savedResponses : undefined
            const scripts = this.normalizeScripts(item)

            return {
                id,
                type: 'request',
                name,
                method: requestMethod.toUpperCase(),
                url: requestUrl,
                headers: this.normalizeKvRows(Array.isArray(item?.headers) ? item.headers : []),
                params: this.normalizeKvRows(Array.isArray(item?.params) ? item.params : []),
                body:
                    item?.body && typeof item.body === 'object'
                        ? { type: item.body.type || 'none', content: item.body.content || '' }
                        : { type: 'none', content: '' },
                auth:
                    item?.auth && typeof item.auth === 'object'
                        ? item.auth
                        : { type: 'inherit' },
                ...(scripts !== undefined && { scripts }),
                protocol,
                ...(subprotocols !== undefined && { subprotocols }),
                ...(savedMessages !== undefined && { savedMessages }),
                ...(messageTemplate !== undefined && { messageTemplate }),
                ...(savedResponses !== undefined && { savedResponses })
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
        protocol?: 'http' | 'ws'
        subprotocols?: string
        savedMessages?: unknown[]
        messageTemplate?: string
    }): CollectionRequestItem {
        const protocol = this.resolveProtocol(args.protocol, args.url)
        return {
            id: args.requestId?.trim() || this.toItemId(args.requestName, Date.now()),
            type: 'request',
            name: args.requestName.trim(),
            method: args.method.toUpperCase(),
            url: args.url,
            headers: this.normalizeKvRows(args.headers),
            params: this.normalizeKvRows(args.params),
            body: args.body ?? { type: 'none', content: '' },
            auth: args.auth ?? { type: 'inherit' },
            ...(args.preRequest !== undefined || args.postResponse !== undefined
                ? {
                      scripts: {
                          ...(args.preRequest !== undefined && { preRequest: args.preRequest }),
                          ...(args.postResponse !== undefined && { postResponse: args.postResponse })
                      }
                  }
                : {}),
            protocol,
            ...(args.subprotocols !== undefined && { subprotocols: args.subprotocols }),
            ...(args.savedMessages !== undefined && { savedMessages: args.savedMessages }),
            ...(args.messageTemplate !== undefined && { messageTemplate: args.messageTemplate })
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

    private updateFolderById(
        items: CollectionTreeItem[],
        folderId: string,
        updater: (current: CollectionFolderItem) => CollectionFolderItem
    ): { items: CollectionTreeItem[]; updated: boolean } {
        let updated = false
        const next = items.map((item) => {
            if (item.type !== 'folder') return item

            if (item.id === folderId) {
                updated = true
                return updater(item)
            }

            const nested = this.updateFolderById(item.items, folderId, updater)
            if (nested.updated) {
                updated = true
                return { ...item, items: nested.items }
            }

            return item
        })

        return { items: next, updated }
    }

    private deleteItemById(
        items: CollectionTreeItem[],
        itemId: string,
        expectedType?: 'request' | 'folder'
    ): { items: CollectionTreeItem[]; deleted: boolean } {
        let deleted = false
        const next: CollectionTreeItem[] = []

        for (const item of items) {
            if (item.id === itemId && (!expectedType || item.type === expectedType)) {
                deleted = true
                continue
            }

            if (item.type === 'folder') {
                const nested = this.deleteItemById(item.items, itemId, expectedType)
                if (nested.deleted) {
                    deleted = true
                    next.push({ ...item, items: nested.items })
                    continue
                }
            }

            next.push(item)
        }

        return { items: next, deleted }
    }

    private findItemById(
        items: CollectionTreeItem[],
        itemId: string
    ): CollectionTreeItem | null {
        for (const item of items) {
            if (item.id === itemId) return item
            if (item.type === 'folder') {
                const nested = this.findItemById(item.items, itemId)
                if (nested) return nested
            }
        }
        return null
    }

    private containsId(items: CollectionTreeItem[], itemId: string): boolean {
        return this.findItemById(items, itemId) != null
    }

    private extractItemById(
        items: CollectionTreeItem[],
        itemId: string
    ): { items: CollectionTreeItem[]; extracted: CollectionTreeItem | null } {
        let extracted: CollectionTreeItem | null = null
        const next: CollectionTreeItem[] = []

        for (const item of items) {
            if (item.id === itemId) {
                extracted = item
                continue
            }

            if (item.type === 'folder') {
                const nested = this.extractItemById(item.items, itemId)
                if (nested.extracted) {
                    extracted = nested.extracted
                    next.push({ ...item, items: nested.items })
                    continue
                }
            }

            next.push(item)
        }

        return { items: next, extracted }
    }

    private insertItem(
        items: CollectionTreeItem[],
        parentFolderId: string | undefined,
        item: CollectionTreeItem,
        index?: number
    ): { items: CollectionTreeItem[]; inserted: boolean } {
        const place = (list: CollectionTreeItem[]): CollectionTreeItem[] => {
            if (index === undefined || index < 0 || index >= list.length) {
                return [...list, item]
            }
            const copy = [...list]
            copy.splice(index, 0, item)
            return copy
        }

        if (!parentFolderId) {
            return { items: place(items), inserted: true }
        }

        let inserted = false
        const next = items.map((node) => {
            if (node.type !== 'folder') return node

            if (node.id === parentFolderId) {
                inserted = true
                return { ...node, items: place(node.items) }
            }

            const nested = this.insertItem(node.items, parentFolderId, item, index)
            if (nested.inserted) {
                inserted = true
                return { ...node, items: nested.items }
            }

            return node
        })

        return { items: next, inserted }
    }

    private moveItem(
        items: CollectionTreeItem[],
        itemId: string,
        targetParentFolderId?: string,
        index?: number
    ): { items: CollectionTreeItem[]; moved: boolean } {
        const existing = this.findItemById(items, itemId)
        if (!existing) return { items, moved: false }

        if (existing.type === 'folder' && targetParentFolderId) {
            if (existing.id === targetParentFolderId) {
                throw new BadRequestException('Cannot move a folder into itself')
            }
            if (this.containsId(existing.items, targetParentFolderId)) {
                throw new BadRequestException('Cannot move a folder into its descendant')
            }
        }

        const { items: without, extracted } = this.extractItemById(items, itemId)
        if (!extracted) return { items, moved: false }

        const { items: next, inserted } = this.insertItem(
            without,
            targetParentFolderId,
            extracted,
            index
        )
        if (!inserted) {
            throw new BadRequestException(`Target folder not found: ${targetParentFolderId}`)
        }

        return { items: next, moved: true }
    }

    private async loadNormalizedItems(collectionId: number, userId: number) {
        const collection = await this.collectionsService.findOne(collectionId, userId)
        const items = (this.normalizeItems(
            Array.isArray(collection.items) ? collection.items : []
        ) ?? []) as CollectionTreeItem[]
        return { collection, items }
    }

    private async persistItems(
        collectionId: number,
        userId: number,
        items: CollectionTreeItem[],
        concurrency?: { expectedUpdatedAt?: string; force?: boolean }
    ) {
        return this.collectionsService.update(
            collectionId,
            {
                items,
                expectedUpdatedAt: concurrency?.expectedUpdatedAt,
                force: concurrency?.force
            },
            userId
        )
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
            protocol: z.enum(['http', 'ws']).optional(),
            subprotocols: z.string().optional(),
            savedMessages: z.array(z.any()).optional(),
            messageTemplate: z.string().optional(),
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
            protocol?: 'http' | 'ws'
            subprotocols?: string
            savedMessages?: unknown[]
            messageTemplate?: string
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
            protocol: z.enum(['http', 'ws']).optional(),
            subprotocols: z.string().optional(),
            savedMessages: z.array(z.any()).optional(),
            messageTemplate: z.string().optional(),
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
            protocol?: 'http' | 'ws'
            subprotocols?: string
            savedMessages?: unknown[]
            messageTemplate?: string
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

        const { items, updated } = this.updateRequestById(normalizedItems, args.requestId, (current) => {
            const nextUrl = args.url ?? current.url
            const nextProtocol =
                args.protocol !== undefined
                    ? args.protocol
                    : args.url !== undefined
                      ? this.resolveProtocol(current.protocol, nextUrl)
                      : current.protocol

            return {
                ...current,
                ...(args.requestName !== undefined && { name: args.requestName.trim() }),
                ...(args.method !== undefined && { method: args.method.toUpperCase() }),
                ...(args.url !== undefined && { url: args.url }),
                ...(args.headers !== undefined && { headers: this.normalizeKvRows(args.headers) }),
                ...(args.params !== undefined && { params: this.normalizeKvRows(args.params) }),
                ...(args.body !== undefined && { body: args.body }),
                ...(args.auth !== undefined && { auth: args.auth }),
                ...(nextProtocol !== undefined && { protocol: nextProtocol }),
                ...(args.subprotocols !== undefined && { subprotocols: args.subprotocols }),
                ...(args.savedMessages !== undefined && { savedMessages: args.savedMessages }),
                ...(args.messageTemplate !== undefined && { messageTemplate: args.messageTemplate }),
                scripts: {
                    ...(current.scripts ?? {}),
                    ...(args.preRequest !== undefined && { preRequest: args.preRequest }),
                    ...(args.postResponse !== undefined && { postResponse: args.postResponse })
                }
            }
        })

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
        name: 'collections_delete_request',
        description: 'Delete a request from a collection by requestId',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            requestId: z.string().min(1),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async deleteRequest(
        args: {
            collectionId: number
            requestId: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { items: normalizedItems } = await this.loadNormalizedItems(args.collectionId, userId)
        const { items, deleted } = this.deleteItemById(normalizedItems, args.requestId, 'request')
        if (!deleted) {
            throw new BadRequestException(`Request not found: ${args.requestId}`)
        }

        const data = await this.persistItems(args.collectionId, userId, items, args)
        return { ok: true, message: 'Request deleted successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_delete_folder',
        description: 'Delete a folder and its children from a collection by folderId',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            folderId: z.string().min(1),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async deleteFolder(
        args: {
            collectionId: number
            folderId: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { items: normalizedItems } = await this.loadNormalizedItems(args.collectionId, userId)
        const { items, deleted } = this.deleteItemById(normalizedItems, args.folderId, 'folder')
        if (!deleted) {
            throw new BadRequestException(`Folder not found: ${args.folderId}`)
        }

        const data = await this.persistItems(args.collectionId, userId, items, args)
        return { ok: true, message: 'Folder deleted successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_update_folder',
        description: 'Rename a folder in a collection',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            folderId: z.string().min(1),
            folderName: z.string().min(1),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async updateFolder(
        args: {
            collectionId: number
            folderId: string
            folderName: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { items: normalizedItems } = await this.loadNormalizedItems(args.collectionId, userId)
        const { items, updated } = this.updateFolderById(normalizedItems, args.folderId, (current) => ({
            ...current,
            name: args.folderName.trim()
        }))
        if (!updated) {
            throw new BadRequestException(`Folder not found: ${args.folderId}`)
        }

        const data = await this.persistItems(args.collectionId, userId, items, args)
        return { ok: true, message: 'Folder updated successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_move_item',
        description:
            'Move a request or folder within a collection. Omit targetParentFolderId to move to collection root. Rejects cyclic folder moves.',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            itemId: z.string().min(1),
            targetParentFolderId: z.string().min(1).optional(),
            index: z.number().int().nonnegative().optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async moveItemTool(
        args: {
            collectionId: number
            itemId: string
            targetParentFolderId?: string
            index?: number
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        const userId = await this.identityService.resolveUserId(req)
        const { items: normalizedItems } = await this.loadNormalizedItems(args.collectionId, userId)
        const { items, moved } = this.moveItem(
            normalizedItems,
            args.itemId,
            args.targetParentFolderId,
            args.index
        )
        if (!moved) {
            throw new BadRequestException(`Item not found: ${args.itemId}`)
        }

        const data = await this.persistItems(args.collectionId, userId, items, args)
        return { ok: true, message: 'Item moved successfully', data }
    }

    @ToolScopes(['collections:write'])
    @Tool({
        name: 'collections_set_scripts',
        description:
            'Patch only preRequest and/or postResponse scripts on a request (scripts-only update)',
        parameters: z.object({
            collectionId: z.number().int().positive(),
            requestId: z.string().min(1),
            preRequest: z.string().optional(),
            postResponse: z.string().optional(),
            expectedUpdatedAt: z.string().optional(),
            force: z.boolean().optional()
        })
    })
    async setScripts(
        args: {
            collectionId: number
            requestId: string
            preRequest?: string
            postResponse?: string
            expectedUpdatedAt?: string
            force?: boolean
        },
        _context: unknown,
        req?: McpRequestWithUser
    ) {
        if (args.preRequest === undefined && args.postResponse === undefined) {
            throw new BadRequestException('Provide preRequest and/or postResponse')
        }

        const userId = await this.identityService.resolveUserId(req)
        const { items: normalizedItems } = await this.loadNormalizedItems(args.collectionId, userId)
        const { items, updated } = this.updateRequestById(normalizedItems, args.requestId, (current) => ({
            ...current,
            scripts: {
                ...(current.scripts ?? {}),
                ...(args.preRequest !== undefined && { preRequest: args.preRequest }),
                ...(args.postResponse !== undefined && { postResponse: args.postResponse })
            }
        }))
        if (!updated) {
            throw new BadRequestException(`Request not found: ${args.requestId}`)
        }

        const data = await this.persistItems(args.collectionId, userId, items, args)
        return { ok: true, message: 'Scripts updated successfully', data }
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
