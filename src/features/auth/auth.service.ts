import { randomBytes } from 'crypto'
import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    InternalServerErrorException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

type GithubEmailRow = { email: string; primary?: boolean; verified?: boolean }

type AuthUserPayload = { id: number; name: string; email: string; hasPassword: boolean }

type OAuthBridgePayload = { access_token: string; user: AuthUserPayload }

type BridgeRow = { exp: number; payload: OAuthBridgePayload }

@Injectable()
export class AuthService {
    constructor(
        readonly prismaService: PrismaService,
        readonly jwtService: JwtService,
        readonly configService: ConfigService
    ) {}

    private readonly oauthBridges = new Map<string, BridgeRow>()
    private readonly oauthBridgeTtlMs = 5 * 60 * 1000

    /** Short-lived single-use code so zreq:// URL stays small (long JWT links often fail to open). */
    createOAuthBridge(payload: OAuthBridgePayload): string {
        const id = randomBytes(18).toString('base64url')
        this.oauthBridges.set(id, {
            exp: Date.now() + this.oauthBridgeTtlMs,
            payload
        })
        return id
    }

    consumeOAuthBridge(code: string): OAuthBridgePayload | null {
        const row = this.oauthBridges.get(code)
        if (!row || Date.now() > row.exp) {
            this.oauthBridges.delete(code)
            return null
        }
        this.oauthBridges.delete(code)
        return row.payload
    }

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase()
        const existing = await this.prismaService.user.findUnique({
            where: { email }
        })
        if (existing) throw new ConflictException('Email already in use')

        const hashed = await bcrypt.hash(dto.password, 10)
        const user = await this.prismaService.user.create({
            data: {
                name: dto.name,
                email,
                password: hashed,
                workspaces: { create: [{ name: 'Default' }] }
            }
        })

        const token = this.jwtService.sign({ sub: user.id, email: user.email })
        return {
            access_token: token,
            user: { id: user.id, name: user.name, email: user.email, hasPassword: true }
        }
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase()
        const user = await this.prismaService.user.findUnique({
            where: { email }
        })
        if (!user) throw new UnauthorizedException('Invalid credentials')
        if (!user.password) {
            throw new UnauthorizedException('This account uses GitHub sign-in')
        }

        const valid = await bcrypt.compare(dto.password, user.password)
        if (!valid) throw new UnauthorizedException('Invalid credentials')

        const token = this.jwtService.sign({ sub: user.id, email: user.email })
        return {
            access_token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                hasPassword: !!user.password
            }
        }
    }

    createGithubOAuthState(ctx?: string): string {
        return this.jwtService.sign({ p: 'gh_oauth', ...(ctx ? { ctx } : {}) }, { expiresIn: '10m' })
    }

    verifyGithubOAuthState(state: string): { ctx?: string } {
        try {
            const payload = this.jwtService.verify<{ p?: string; ctx?: string }>(state)
            if (payload.p !== 'gh_oauth') throw new Error('bad purpose')
            return { ctx: payload.ctx }
        } catch {
            throw new BadRequestException('Invalid or expired OAuth state')
        }
    }

    async completeGithubOAuth(code: string, state: string) {
        this.verifyGithubOAuthState(state)
        const clientId = this.configService.get<string>('GITHUB_CLIENT_ID')
        const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET')
        const callbackUrl = this.configService.get<string>('GITHUB_CALLBACK_URL')
        if (!clientId || !clientSecret || !callbackUrl) {
            throw new InternalServerErrorException('GitHub OAuth is not configured')
        }

        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: callbackUrl
            }).toString()
        })
        const tokenJson = (await tokenRes.json()) as {
            access_token?: string
            error?: string
            error_description?: string
        }
        if (!tokenRes.ok || !tokenJson.access_token) {
            throw new BadRequestException(
                tokenJson.error_description || tokenJson.error || 'GitHub token exchange failed'
            )
        }
        const ghAccess = tokenJson.access_token

        const profileRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${ghAccess}`,
                Accept: 'application/vnd.github+json'
            }
        })
        if (!profileRes.ok) throw new BadRequestException('Could not load GitHub profile')
        const profile = (await profileRes.json()) as {
            id: number
            login: string
            name: string | null
            email: string | null
        }

        let email = profile.email?.trim().toLowerCase() ?? ''
        if (!email) {
            const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${ghAccess}`,
                    Accept: 'application/vnd.github+json'
                }
            })
            if (!emailsRes.ok) throw new BadRequestException('Could not load GitHub emails')
            const rows = (await emailsRes.json()) as GithubEmailRow[]
            const verified = rows.filter((r) => r.verified)
            const pick =
                verified.find((r) => r.primary) ?? verified[0] ?? rows.find((r) => r.primary) ?? rows[0]
            email = pick?.email?.trim().toLowerCase() ?? ''
        }
        if (!email) {
            throw new BadRequestException('GitHub did not return a verified email for this account')
        }

        const githubId = String(profile.id)
        const name = (profile.name || profile.login || email.split('@')[0] || 'User').slice(0, 191)

        const existingGh = await this.prismaService.user.findUnique({ where: { githubId } })
        if (existingGh) {
            return this.issueAuthPayload(
                existingGh.id,
                existingGh.email,
                existingGh.name,
                !!existingGh.password
            )
        }

        const byEmail = await this.prismaService.user.findUnique({ where: { email } })
        if (byEmail) {
            const linked = await this.prismaService.user.update({
                where: { id: byEmail.id },
                data: { githubId }
            })
            return this.issueAuthPayload(linked.id, linked.email, linked.name, !!linked.password)
        }

        const created = await this.prismaService.user.create({
            data: {
                name,
                email,
                githubId,
                workspaces: { create: [{ name: 'Default' }] }
            }
        })
        return this.issueAuthPayload(created.id, created.email, created.name, false)
    }

    private issueAuthPayload(id: number, email: string, name: string, hasPassword: boolean) {
        const token = this.jwtService.sign({ sub: id, email })
        return { access_token: token, user: { id, name, email, hasPassword } }
    }
}
