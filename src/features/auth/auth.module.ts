import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PrismaModule } from 'src/config/prisma/prisma.module'

@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('SECRET'),
                signOptions: { expiresIn: '7d' }
            }),
            inject: [ConfigService]
        })
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [JwtModule, AuthService]
})
export class AuthModule {}
