import { Injectable, UnauthorizedException } from '@nestjs/common'
import type { McpRequestWithUser } from '@rekog/mcp-nest'
import { PrismaService } from 'src/config/prisma/prisma.service'

@Injectable()
export class McpIdentityService {
    constructor(private readonly prisma: PrismaService) {}

    async resolveUserId(req?: McpRequestWithUser): Promise<number> {
        const email = req?.user?.email?.trim().toLowerCase()
        if (!email) {
            throw new UnauthorizedException('Authenticated MCP user email is required')
        }

        const existing = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true }
        })
        if (existing) return existing.id

        const fallbackName = req?.user?.displayName || req?.user?.username || email.split('@')[0] || 'User'
        const created = await this.prisma.user.create({
            data: {
                email,
                name: fallbackName.slice(0, 191),
                workspaces: { create: [{ name: 'Default' }] }
            },
            select: { id: true }
        })
        return created.id
    }
}
