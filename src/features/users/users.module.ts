import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
    imports: [AuthModule],
    controllers: [UsersController],
    providers: [UsersService]
})
export class UsersModule {}
