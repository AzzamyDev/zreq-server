import { Module } from '@nestjs/common'
import { PrismaModule } from 'src/config/prisma/prisma.module'
import { AuthModule } from 'src/features/auth/auth.module'
import { ConfigModule } from '@nestjs/config'
import { McpOAuthClientsService } from './mcp-oauth-clients.service'
import { McpOAuthClientsController } from './mcp-oauth-clients.controller'

@Module({
    imports: [PrismaModule, AuthModule, ConfigModule],
    controllers: [McpOAuthClientsController],
    providers: [McpOAuthClientsService]
})
export class McpOAuthClientsModule {}
