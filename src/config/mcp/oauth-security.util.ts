import { createHmac } from 'crypto'

const hashAlgo = 'sha256'

const resolvePepper = () =>
    process.env.MCP_OAUTH_SECRET_PEPPER || process.env.MCP_JWT_SECRET || process.env.SECRET || 'zreq-mcp-oauth-pepper'

export const hashClientSecret = (rawSecret: string) => {
    const digest = createHmac(hashAlgo, resolvePepper()).update(rawSecret).digest('hex')
    return `${hashAlgo}:${digest}`
}

export const isHashedClientSecret = (value?: string | null) =>
    typeof value === 'string' && value.startsWith(`${hashAlgo}:`)
