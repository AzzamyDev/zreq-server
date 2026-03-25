/**
 * A pass-through OAuth store that delegates to a PrismaOAuthStore instance
 * set after NestJS DI resolves. This lets McpAuthModule.forRoot (sync-only)
 * receive a placeholder at registration time, while the real implementation
 * uses the singleton PrismaService from the DI container.
 */
import type { OAuthSession, OAuthUserProfile } from '@rekog/mcp-nest'
import type { AuthorizationCode, IOAuthStore, OAuthClient } from '@rekog/mcp-nest'
import type { PrismaOAuthStore } from './prisma-oauth.store'

export class DeferredOAuthStore implements IOAuthStore {
    private impl: PrismaOAuthStore | null = null

    setImpl(store: PrismaOAuthStore) {
        this.impl = store
    }

    private get store(): PrismaOAuthStore {
        if (!this.impl) throw new Error('DeferredOAuthStore: impl not set — call setImpl() in OnModuleInit')
        return this.impl
    }

    storeClient(client: OAuthClient) { return this.store.storeClient(client) }
    getClient(client_id: string) { return this.store.getClient(client_id) }
    findClient(client_name: string) { return this.store.findClient(client_name) }
    generateClientId(client: OAuthClient) { return this.store.generateClientId(client) }
    storeAuthCode(code: AuthorizationCode) { return this.store.storeAuthCode(code) }
    getAuthCode(code: string) { return this.store.getAuthCode(code) }
    removeAuthCode(code: string) { return this.store.removeAuthCode(code) }
    storeOAuthSession(sessionId: string, session: OAuthSession) { return this.store.storeOAuthSession(sessionId, session) }
    getOAuthSession(sessionId: string) { return this.store.getOAuthSession(sessionId) }
    removeOAuthSession(sessionId: string) { return this.store.removeOAuthSession(sessionId) }
    upsertUserProfile(profile: OAuthUserProfile, provider: string) { return this.store.upsertUserProfile(profile, provider) }
    getUserProfileById(profileId: string) { return this.store.getUserProfileById(profileId) }
}

export const deferredOAuthStore = new DeferredOAuthStore()
