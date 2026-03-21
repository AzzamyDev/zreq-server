import { Module } from '@nestjs/common'
import { WorkspacesService } from './workspaces.service'
import { WorkspacesController } from './workspaces.controller'
import { PrismaModule } from 'src/config/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { ConfigModule } from '@nestjs/config'

@Module({
    imports: [PrismaModule, AuthModule, ConfigModule],
    controllers: [WorkspacesController],
    providers: [WorkspacesService],
    exports: [WorkspacesService]
})
export class WorkspacesModule {}
