import { Module } from '@nestjs/common'
import { McpAuthJwtGuard, McpAuthModule, McpModule, McpTransportType } from '@rekog/mcp-nest'
import { CollectionsModule } from 'src/features/collections/collections.module'
import { EnvironmentsModule } from 'src/features/environments/environments.module'
import { WorkspacesModule } from 'src/features/workspaces/workspaces.module'
import { CollectionsMcpTool } from './tools/collections.mcp-tool'
import { EnvironmentsMcpTool } from './tools/environments.mcp-tool'
import { WorkspacesMcpTool } from './tools/workspaces.mcp-tool'
import { UtilityMcpTool } from './tools/utility.mcp-tool'
import { McpIdentityService } from './mcp-identity.service'
import { LocalAccountOAuthProvider } from './custom-oauth.provider'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { PrismaOAuthStore } from './prisma-oauth.store'
import { AuthModule } from 'src/features/auth/auth.module'
import { McpLocalLoginController } from './mcp-local-login.controller'

const toValidMcpJwtSecret = () => {
    const raw =
        process.env.MCP_JWT_SECRET ||
        process.env.SECRET ||
        'zreq-mcp-dev-secret-change-me-to-32-plus-chars'
    return raw.length >= 32 ? raw : `${raw}${'_'.repeat(32 - raw.length)}`
}

const mcpOAuthStore = new PrismaOAuthStore(new PrismaService())

@Module({
    imports: [
        CollectionsModule,
        EnvironmentsModule,
        WorkspacesModule,
        AuthModule,
        McpAuthModule.forRoot({
            provider: LocalAccountOAuthProvider,
            clientId: process.env.MCP_CLIENT_ID || 'zreq-mcp-client',
            clientSecret: process.env.MCP_CLIENT_SECRET || 'zreq-mcp-client-secret',
            jwtSecret: toValidMcpJwtSecret(),
            enableRefreshTokens: process.env.MCP_ENABLE_REFRESH_TOKENS === 'true',
            serverUrl: process.env.MCP_SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
            resource: process.env.MCP_RESOURCE || 'zreq-mcp',
            apiPrefix: process.env.MCP_API_PREFIX || '',
            endpoints: {
                authorize: process.env.MCP_OAUTH_AUTHORIZE_PATH || '/mcp/oauth/authorize',
                callback: process.env.MCP_OAUTH_CALLBACK_PATH || '/mcp/oauth/callback',
                token: process.env.MCP_OAUTH_TOKEN_PATH || '/mcp/oauth/token',
                register: process.env.MCP_OAUTH_REGISTER_PATH || '/mcp/oauth/register'
            },
            protectedResourceMetadata: {
                scopesSupported: [
                    'profile:read',
                    'collections:read',
                    'collections:write',
                    'environments:read',
                    'environments:write',
                    'workspaces:read',
                    'workspaces:write'
                ]
            },
            authorizationServerMetadata: {
                scopesSupported: [
                    'profile:read',
                    'collections:read',
                    'collections:write',
                    'environments:read',
                    'environments:write',
                    'workspaces:read',
                    'workspaces:write'
                ],
                codeChallengeMethodsSupported: ['S256']
            },
            storeConfiguration: {
                type: 'custom',
                store: mcpOAuthStore
            }
        }),
        McpModule.forRoot({
            name: process.env.MCP_SERVER_NAME || 'zreq-mcp',
            title: process.env.MCP_SERVER_TITLE || 'ZReq MCP',
            version: process.env.MCP_SERVER_VERSION || '0.1.0',
            description:
                process.env.MCP_SERVER_DESCRIPTION ||
                'MCP server for manipulating collections, environments, and workspaces',
            transport: McpTransportType.STREAMABLE_HTTP,
            apiPrefix: process.env.MCP_API_PREFIX || '',
            mcpEndpoint: process.env.MCP_ENDPOINT || '/mcp',
            guards: [McpAuthJwtGuard]
        })
    ],
    controllers: [McpLocalLoginController],
    providers: [
        McpIdentityService,
        CollectionsMcpTool,
        EnvironmentsMcpTool,
        WorkspacesMcpTool,
        UtilityMcpTool
    ]
})
export class ZreqMcpModule {}
