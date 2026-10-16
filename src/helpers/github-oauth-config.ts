export type GithubOAuthEnv = {
    clientId: string
    callbackUrl: string
}

/** True when GitHub OAuth env looks usable (not empty / not .env.example placeholder). */
export const isGithubOAuthConfigured = (
    clientId?: string | null,
    callbackUrl?: string | null
): boolean => {
    const id = clientId?.trim() ?? ''
    const cb = callbackUrl?.trim() ?? ''
    if (!id || !cb) return false
    if (/your\.backend\.url/i.test(cb)) return false
    return true
}

/** Resolved GitHub OAuth env, or `null` if missing / placeholder. */
export const resolveGithubOAuthEnv = (
    clientId?: string | null,
    callbackUrl?: string | null
): GithubOAuthEnv | null => {
    const id = clientId?.trim() ?? ''
    const cb = callbackUrl?.trim() ?? ''
    if (!isGithubOAuthConfigured(id, cb)) return null
    return { clientId: id, callbackUrl: cb }
}
