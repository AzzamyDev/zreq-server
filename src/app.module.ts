import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './config/prisma/prisma.module'
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import { UsersModule } from './features/users/users.module'
import { AuthModule } from './features/auth/auth.module'
import { CollectionsModule } from './features/collections/collections.module'
import { EnvironmentsModule } from './features/environments/environments.module'
import { WorkspacesModule } from './features/workspaces/workspaces.module'
import { HealthController } from './health/health.controller'
import { ZreqMcpModule } from './config/mcp/mcp.module'

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        UsersModule,
        AuthModule,
        WorkspacesModule,
        CollectionsModule,
        EnvironmentsModule,
        ZreqMcpModule
    ],
    controllers: [HealthController],
    providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor }
    ]
})
export class AppModule {}
