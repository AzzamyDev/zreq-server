import { createHash } from 'crypto'
import type { OAuthSession, OAuthUserProfile } from '@rekog/mcp-nest'
import type { AuthorizationCode, IOAuthStore, OAuthClient } from '@rekog/mcp-nest'
import type { Prisma } from '@prisma/generated/client'
import { PrismaService } from 'src/config/prisma/prisma.service'
import { hashClientSecret, isHashedClientSecret } from './oauth-security.util'

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : [])

export class PrismaOAuthStore implements IOAuthStore {
    constructor(private readonly prisma: PrismaService) {}

    async storeClient(client: OAuthClient): Promise<OAuthClient> {
        const hashedSecret = client.client_secret
            ? isHashedClientSecret(client.client_secret)
                ? client.client_secret
                : hashClientSecret(client.client_secret)
            : null

        const row = await this.prisma.oAuthClientStore.upsert({
            where: { clientId: client.client_id },
            update: {
                clientSecretHash: hashedSecret,
                clientSecret: null,
                clientName: client.client_name,
                clientDescription: client.client_description ?? null,
                logoUri: client.logo_uri ?? null,
                clientUri: client.client_uri ?? null,
                developerName: client.developer_name ?? null,
                developerEmail: client.developer_email ?? null,
                redirectUris: client.redirect_uris,
                grantTypes: client.grant_types,
                responseTypes: client.response_types,
                tokenEndpointAuthMethod: client.token_endpoint_auth_method
            },
            create: {
                clientId: client.client_id,
                clientSecretHash: hashedSecret,
                clientSecret: null,
                clientName: client.client_name,
                clientDescription: client.client_description ?? null,
                logoUri: client.logo_uri ?? null,
                clientUri: client.client_uri ?? null,
                developerName: client.developer_name ?? null,
                developerEmail: client.developer_email ?? null,
                redirectUris: client.redirect_uris,
                grantTypes: client.grant_types,
                responseTypes: client.response_types,
                tokenEndpointAuthMethod: client.token_endpoint_auth_method
            }
        })
        return {
            ...this.mapClient(row),
            // Registration response should reveal original secret exactly once.
            client_secret: client.client_secret
        }
    }

    async getClient(client_id: string): Promise<OAuthClient | undefined> {
        const row = await this.prisma.oAuthClientStore.findUnique({ where: { clientId: client_id } })
        if (!row) return undefined
        return this.normalizeClientSecret(row)
    }

    async findClient(client_name: string): Promise<OAuthClient | undefined> {
        const row = await this.prisma.oAuthClientStore.findFirst({ where: { clientName: client_name } })
        if (!row) return undefined
        return this.normalizeClientSecret(row)
    }

    async storeAuthCode(code: AuthorizationCode): Promise<void> {
        await this.prisma.oAuthAuthorizationCode.upsert({
            where: { code: code.code },
            update: {
                userId: code.user_id,
                clientId: code.client_id,
                redirectUri: code.redirect_uri,
                codeChallenge: code.code_challenge,
                codeChallengeMethod: code.code_challenge_method,
                resource: code.resource ?? null,
                scope: code.scope ?? null,
                expiresAt: BigInt(code.expires_at),
                usedAt: code.used_at ?? null,
                userProfileId: code.user_profile_id ?? null
            },
            create: {
                code: code.code,
                userId: code.user_id,
                clientId: code.client_id,
                redirectUri: code.redirect_uri,
                codeChallenge: code.code_challenge,
                codeChallengeMethod: code.code_challenge_method,
                resource: code.resource ?? null,
                scope: code.scope ?? null,
                expiresAt: BigInt(code.expires_at),
                usedAt: code.used_at ?? null,
                userProfileId: code.user_profile_id ?? null
            }
        })
    }

    async getAuthCode(code: string): Promise<AuthorizationCode | undefined> {
        const row = await this.prisma.oAuthAuthorizationCode.findUnique({ where: { code } })
        if (!row) return undefined
        return {
            code: row.code,
            user_id: row.userId,
            client_id: row.clientId,
            redirect_uri: row.redirectUri,
            code_challenge: row.codeChallenge,
            code_challenge_method: row.codeChallengeMethod,
            resource: row.resource ?? undefined,
            scope: row.scope ?? undefined,
            expires_at: Number(row.expiresAt),
            used_at: row.usedAt ?? undefined,
            user_profile_id: row.userProfileId ?? undefined
        }
    }

    async removeAuthCode(code: string): Promise<void> {
        await this.prisma.oAuthAuthorizationCode.deleteMany({ where: { code } })
    }

    async storeOAuthSession(sessionId: string, session: OAuthSession): Promise<void> {
        await this.prisma.oAuthSessionStore.upsert({
            where: { sessionId },
            update: {
                state: session.state,
                clientId: session.clientId ?? null,
                redirectUri: session.redirectUri ?? null,
                codeChallenge: session.codeChallenge ?? null,
                codeChallengeMethod: session.codeChallengeMethod ?? null,
                oauthState: session.oauthState ?? null,
                scope: session.scope ?? null,
                resource: session.resource ?? null,
                expiresAt: BigInt(session.expiresAt)
            },
            create: {
                sessionId,
                state: session.state,
                clientId: session.clientId ?? null,
                redirectUri: session.redirectUri ?? null,
                codeChallenge: session.codeChallenge ?? null,
                codeChallengeMethod: session.codeChallengeMethod ?? null,
                oauthState: session.oauthState ?? null,
                scope: session.scope ?? null,
                resource: session.resource ?? null,
                expiresAt: BigInt(session.expiresAt)
            }
        })
    }

    async getOAuthSession(sessionId: string): Promise<OAuthSession | undefined> {
        const row = await this.prisma.oAuthSessionStore.findUnique({ where: { sessionId } })
        if (!row) return undefined
        if (Number(row.expiresAt) < Date.now()) {
            await this.removeOAuthSession(sessionId)
            return undefined
        }
        return {
            sessionId: row.sessionId,
            state: row.state,
            clientId: row.clientId ?? undefined,
            redirectUri: row.redirectUri ?? undefined,
            codeChallenge: row.codeChallenge ?? undefined,
            codeChallengeMethod: row.codeChallengeMethod ?? undefined,
            oauthState: row.oauthState ?? undefined,
            scope: row.scope ?? undefined,
            resource: row.resource ?? undefined,
            expiresAt: Number(row.expiresAt)
        }
    }

    async removeOAuthSession(sessionId: string): Promise<void> {
        await this.prisma.oAuthSessionStore.deleteMany({ where: { sessionId } })
    }

    generateClientId(client: OAuthClient): string {
        const normalized = JSON.stringify({
            client_name: client.client_name,
            redirect_uris: toStringArray(client.redirect_uris).sort(),
            grant_types: toStringArray(client.grant_types).sort(),
            response_types: toStringArray(client.response_types).sort(),
            token_endpoint_auth_method: client.token_endpoint_auth_method
        })
        const hash = createHash('sha256').update(normalized).digest('hex')
        return `${client.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${hash.slice(0, 16)}`
    }

    async upsertUserProfile(profile: OAuthUserProfile, provider: string): Promise<string> {
        const providerUserId = String(profile.id)
        const profileId = createHash('sha256')
            .update(`${provider}:${providerUserId}`)
            .digest('hex')
            .slice(0, 24)

        await this.prisma.oAuthUserProfileStore.upsert({
            where: { provider_providerUserId: { provider, providerUserId } },
            update: { profileId, profile: profile as unknown as Prisma.InputJsonValue },
            create: {
                profileId,
                provider,
                providerUserId,
                profile: profile as unknown as Prisma.InputJsonValue
            }
        })
        return profileId
    }

    async getUserProfileById(
        profileId: string
    ): Promise<(OAuthUserProfile & { profile_id: string; provider: string }) | undefined> {
        const row = await this.prisma.oAuthUserProfileStore.findUnique({ where: { profileId } })
        if (!row) return undefined
        const profile = row.profile as unknown as OAuthUserProfile
        return { ...profile, profile_id: row.profileId, provider: row.provider }
    }

    private mapClient(row: {
        clientId: string
        clientSecret: string | null
        clientSecretHash: string | null
        clientName: string
        clientDescription: string | null
        logoUri: string | null
        clientUri: string | null
        developerName: string | null
        developerEmail: string | null
        redirectUris: unknown
        grantTypes: unknown
        responseTypes: unknown
        tokenEndpointAuthMethod: string
        createdAt: Date
        updatedAt: Date
    }): OAuthClient {
        return {
            client_id: row.clientId,
            client_secret: row.clientSecretHash ?? row.clientSecret ?? undefined,
            client_name: row.clientName,
            client_description: row.clientDescription ?? undefined,
            logo_uri: row.logoUri ?? undefined,
            client_uri: row.clientUri ?? undefined,
            developer_name: row.developerName ?? undefined,
            developer_email: row.developerEmail ?? undefined,
            redirect_uris: toStringArray(row.redirectUris),
            grant_types: toStringArray(row.grantTypes),
            response_types: toStringArray(row.responseTypes),
            token_endpoint_auth_method: row.tokenEndpointAuthMethod,
            created_at: row.createdAt,
            updated_at: row.updatedAt
        }
    }

    private async normalizeClientSecret(row: {
        clientId: string
        clientSecret: string | null
        clientSecretHash: string | null
        clientName: string
        clientDescription: string | null
        logoUri: string | null
        clientUri: string | null
        developerName: string | null
        developerEmail: string | null
        redirectUris: unknown
        grantTypes: unknown
        responseTypes: unknown
        tokenEndpointAuthMethod: string
        createdAt: Date
        updatedAt: Date
    }): Promise<OAuthClient> {
        const secret = row.clientSecretHash || row.clientSecret
        if (secret && !isHashedClientSecret(secret)) {
            const hashed = hashClientSecret(secret)
            await this.prisma.oAuthClientStore.update({
                where: { clientId: row.clientId },
                data: { clientSecretHash: hashed, clientSecret: null }
            })
            return this.mapClient({ ...row, clientSecretHash: hashed, clientSecret: null })
        }
        if (!row.clientSecretHash && row.clientSecret && isHashedClientSecret(row.clientSecret)) {
            await this.prisma.oAuthClientStore.update({
                where: { clientId: row.clientId },
                data: { clientSecretHash: row.clientSecret, clientSecret: null }
            })
            return this.mapClient({ ...row, clientSecretHash: row.clientSecret, clientSecret: null })
        }
        return this.mapClient(row)
    }
}
