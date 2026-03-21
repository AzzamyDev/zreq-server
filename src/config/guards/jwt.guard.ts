import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'

@Injectable()
export class JwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>()
        const auth = req.headers.authorization
        if (!auth || !auth.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid token')
        }
        const token = auth.slice(7)
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get<string>('SECRET')
            })
            req['user'] = { userId: payload.sub, email: payload.email }
            return true
        } catch {
            throw new UnauthorizedException('Invalid or expired token')
        }
    }
}
