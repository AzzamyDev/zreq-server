import { Module } from '@nestjs/common'
import { EnvironmentsController } from './environments.controller'
import { EnvironmentsService } from './environments.service'
import { PrismaModule } from 'src/config/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { ConfigModule } from '@nestjs/config'

@Module({
    imports: [PrismaModule, AuthModule, ConfigModule],
    controllers: [EnvironmentsController],
    providers: [EnvironmentsService]
})
export class EnvironmentsModule {}
