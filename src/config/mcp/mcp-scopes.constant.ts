export const DEFAULT_MCP_SCOPE =
    'profile:read collections:read collections:write environments:read environments:write workspaces:read workspaces:write'

export const resolveMcpScope = (scope?: string | null) => {
    const trimmed = scope?.trim()
    return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_MCP_SCOPE
}
