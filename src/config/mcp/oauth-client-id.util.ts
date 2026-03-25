import { createHash } from 'crypto'
import type { OAuthClient } from '@rekog/mcp-nest'

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : [])

export function generateOAuthClientId(
    client: Pick<
        OAuthClient,
        'client_name' | 'redirect_uris' | 'grant_types' | 'response_types' | 'token_endpoint_auth_method'
    >
): string {
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
