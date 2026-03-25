import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { generateOAuthClientId } from 'src/config/mcp/oauth-client-id.util'
import { hashClientSecret } from 'src/config/mcp/oauth-security.util'
import type { CreateMcpOAuthClientDto } from './dto/create-mcp-oauth-client.dto'
import type { UpdateMcpOAuthClientDto } from './dto/update-mcp-oauth-client.dto'

const defaultGrantTypes = ['authorization_code', 'refresh_token'] as const
const defaultResponseTypes = ['code'] as const

@Injectable()
export class McpOAuthClientsService {
    constructor(private readonly prisma: PrismaService) {}

    private toListItem(row: {
        id: number
        clientId: string
        clientName: string
        purpose: string | null
        redirectUris: unknown
        tokenEndpointAuthMethod: string
        createdAt: Date
        updatedAt: Date
    }) {
        const redirectUris = Array.isArray(row.redirectUris) ? row.redirectUris.map(String) : []
        return {
            id: row.id,
            client_id: row.clientId,
            client_name: row.clientName,
            purpose: row.purpose,
            redirect_uris: redirectUris,
            token_endpoint_auth_method: row.tokenEndpointAuthMethod,
            created_at: row.createdAt.toISOString(),
            updated_at: row.updatedAt.toISOString()
        }
    }

    async list(userId: number) {
        const rows = await this.prisma.oAuthClientStore.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        })
        return rows.map((r) => this.toListItem(r))
    }

    async create(userId: number, dto: CreateMcpOAuthClientDto) {
        const client_name = dto.client_name.trim()
        const redirect_uris = [...new Set(dto.redirect_uris.map((u) => u.trim()).filter(Boolean))]
        const token_endpoint_auth_method = dto.token_endpoint_auth_method
        const client_id = generateOAuthClientId({
            client_name,
            redirect_uris,
            grant_types: [...defaultGrantTypes],
            response_types: [...defaultResponseTypes],
            token_endpoint_auth_method
        })

        const usesSecret = token_endpoint_auth_method !== 'none'
        const client_secret = usesSecret ? randomBytes(32).toString('hex') : null
        const clientSecretHash = client_secret ? hashClientSecret(client_secret) : null

        const existing = await this.prisma.oAuthClientStore.findUnique({
            where: { clientId: client_id },
            select: { id: true, userId: true }
        })

        if (existing && existing.userId !== null && existing.userId !== userId) {
            throw new ConflictException('A client with this configuration already exists and belongs to another user')
        }

        const sharedData = {
            clientName: client_name,
            purpose: dto.purpose?.trim() || null,
            redirectUris: redirect_uris,
            grantTypes: [...defaultGrantTypes],
            responseTypes: [...defaultResponseTypes],
            tokenEndpointAuthMethod: token_endpoint_auth_method,
            userId
        }

        const row = existing
            ? await this.prisma.oAuthClientStore.update({
                  where: { id: existing.id },
                  data: {
                      ...sharedData,
                      ...(usesSecret && { clientSecretHash, clientSecret: null })
                  }
              })
            : await this.prisma.oAuthClientStore.create({
                  data: { clientId: client_id, clientSecretHash, clientSecret: null, ...sharedData }
              })

        return {
            ...this.toListItem(row),
            ...(client_secret ? { client_secret } : {})
        }
    }

    async update(userId: number, id: number, dto: UpdateMcpOAuthClientDto) {
        const existing = await this.prisma.oAuthClientStore.findFirst({
            where: { id, userId }
        })
        if (!existing) throw new NotFoundException('MCP OAuth client not found')
        const client_name = dto.client_name?.trim() ?? existing.clientName
        const redirect_uris =
            dto.redirect_uris != null
                ? [...new Set(dto.redirect_uris.map((u) => u.trim()).filter(Boolean))]
                : Array.isArray(existing.redirectUris)
                  ? existing.redirectUris.map(String)
                  : []
        const token_endpoint_auth_method =
            dto.token_endpoint_auth_method ?? existing.tokenEndpointAuthMethod
        const row = await this.prisma.oAuthClientStore.update({
            where: { id },
            data: {
                ...(dto.client_name !== undefined && { clientName: client_name }),
                ...(dto.redirect_uris !== undefined && { redirectUris: redirect_uris }),
                ...(dto.token_endpoint_auth_method !== undefined && {
                    tokenEndpointAuthMethod: token_endpoint_auth_method
                }),
                ...(dto.purpose !== undefined && {
                    purpose: dto.purpose === null || dto.purpose === '' ? null : dto.purpose.trim()
                })
            }
        })
        return this.toListItem(row)
    }

    async remove(userId: number, id: number) {
        const res = await this.prisma.oAuthClientStore.deleteMany({ where: { id, userId } })
        if (res.count === 0) throw new NotFoundException('MCP OAuth client not found')
    }

    async rotateSecret(userId: number, id: number) {
        const existing = await this.prisma.oAuthClientStore.findFirst({
            where: { id, userId }
        })
        if (!existing) throw new NotFoundException('MCP OAuth client not found')
        if (existing.tokenEndpointAuthMethod === 'none') {
            throw new ForbiddenException('This client uses token_endpoint_auth_method=none; there is no secret to rotate')
        }
        const client_secret = randomBytes(32).toString('hex')
        await this.prisma.oAuthClientStore.update({
            where: { id },
            data: { clientSecretHash: hashClientSecret(client_secret), clientSecret: null }
        })
        return { client_id: existing.clientId, client_secret }
    }
}
