import { Module } from '@nestjs/common'
import { CollectionsController } from './collections.controller'
import { CollectionsService } from './collections.service'
import { PrismaModule } from 'src/config/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { ConfigModule } from '@nestjs/config'
import { WorkspacesModule } from '../workspaces/workspaces.module'

@Module({
    imports: [PrismaModule, AuthModule, ConfigModule, WorkspacesModule],
    controllers: [CollectionsController],
    providers: [CollectionsService],
    exports: [CollectionsService]
})
export class CollectionsModule {}
