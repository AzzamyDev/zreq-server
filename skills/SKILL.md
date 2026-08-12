---
name: zreq-mcp
description: Manage ZReq workspaces, collections, environments, and API requests via MCP. Use when the user mentions ZReq, zreq-mcp, API collections in ZReq, workspace sync, or when manipulating HTTP/WebSocket requests stored in ZReq through MCP tools.
---

# ZReq MCP

ZReq MCP exposes workspace-scoped API collections and environments to AI agents. Use it to read, create, and update collections/requests/environments without touching the ZReq desktop UI.

## Discover MCP server (required first step)

**Never hardcode server IDs.** Server names vary per user and environment (e.g. `user-zreq-mcp-konstruksi`, `user-zreq-mcp-localhost`). Always discover at runtime.

1. `GetMcpTools` with `pattern: "zreq"` — lists all ZReq MCP servers and their tools.
2. From results, pick a server where:
   - `serverStatus` is `ready` (skip `error` unless user targets that instance)
   - Tool set includes ZReq tools (`workspaces_list`, `collections_list`, etc.)
   - Name matches user hint if given (e.g. "localhost", "dit", "konstruksi")
3. If multiple servers match, prefer `ready` over `needsAuth`; if still ambiguous, ask the user.
4. Store the chosen `server` ID and reuse it for all calls in the session.

Re-run discovery if a call fails with connection/auth errors — the user may have added or removed an MCP server.

## Before any tool call

1. Complete server discovery above (once per session).
2. `GetMcpTools` with `server` + `toolName` to load the input schema.
3. If `serverStatus` is `needsAuth`, call `mcp_auth` on that server (empty args), complete OAuth in browser, then retry.
4. Invoke via `CallMcpTool` with the discovered `server`, `toolName`, and `arguments`.

Do not guess server names or parameter shapes — always discover and fetch schema first.

## Standard workflow

```
Task progress:
- [ ] GetMcpTools pattern "zreq"  (discover server)
- [ ] system_health               (optional sanity check)
- [ ] auth_whoami                 (confirm session)
- [ ] workspaces_list             (pick workspace)
- [ ] workspace_get_context       (collections + environments in one call)
- [ ] … mutate or read …
```

**Orient first.** Call `workspace_get_context` after choosing a `workspaceId`. It returns workspace details, collections, and environments scoped to that workspace.

**Prefer granular writes.** Use `collections_add_request`, `collections_add_folder`, or `collections_update_request` instead of replacing the entire `items` tree via `collections_update` unless restructuring the whole collection.

**Scope by workspace.** Pass `workspaceId` to `collections_list`, `collections_create`, and `environments_list`/`environments_create` to avoid cross-workspace confusion.

## Response format

All tools return:

```json
{ "ok": true, "message": "...", "data": { ... } }
```

Read IDs and `updatedAt` from `data`. On failure, the MCP layer surfaces HTTP/OAuth errors — retry auth if 401.

## Optimistic concurrency

Write tools accept optional concurrency fields:

| Field | Purpose |
|-------|---------|
| `expectedUpdatedAt` | ISO timestamp from last read; rejects stale writes |
| `force` | `true` to overwrite despite conflict |

Pattern for updates:

1. `collections_get` or `workspace_get_context` → note `updatedAt`
2. Mutate with `expectedUpdatedAt` set to that value
3. On conflict error → re-fetch, merge intent, retry (or `force: true` if user explicitly wants overwrite)

## Tool reference (quick)

### Auth & health
- `system_health` — no auth required
- `auth_whoami` — current user (`userId`, `email`)
- `auth_logout` — revoke stored OAuth profile

### Workspaces
- `workspaces_list` / `workspaces_create` / `workspaces_update` / `workspaces_delete`
- `workspaces_members_list` / `workspaces_members_add` / `workspaces_members_remove`
- `workspaces_accessible_ids` — lightweight ID list
- `workspace_get_context` — **start here** for a workspace

### Collections
- `collections_list` — optional `workspaceId`
- `collections_get` — full tree with `items`
- `collections_create` — `name`, optional `workspaceId`, optional `items`
- `collections_update` — rename or replace entire `items` tree
- `collections_delete`
- `collections_add_folder` — `collectionId`, `folderName`, optional `parentFolderId`
- `collections_add_request` — add single HTTP/WS request
- `collections_update_request` — patch one request by `requestId`

### Environments
- `environments_list` — optional `workspaceId`
- `environments_get` / `environments_create` / `environments_update` / `environments_delete`
- `environments_update` **replaces** all variables when `variables` is provided

## Collection item schema

Tree nodes use `type: "folder" | "request"`.

**Folder:**
```json
{ "id": "auth-folder", "type": "folder", "name": "Auth", "items": [] }
```

**HTTP request (minimal):**
```json
{
  "id": "login-req",
  "type": "request",
  "name": "Login",
  "method": "POST",
  "url": "{{baseUrl}}/auth/login",
  "protocol": "http",
  "headers": [{ "key": "Content-Type", "value": "application/json", "enabled": true }],
  "params": [],
  "body": { "type": "json", "content": "{\"email\":\"\",\"password\":\"\"}" },
  "auth": { "type": "none" },
  "scripts": { "preRequest": "", "postResponse": "" }
}
```

**WebSocket request:** set `protocol: "ws"`, `url` with `ws://` or `wss://`, plus optional `subprotocols`, `savedMessages`, `messageTemplate`.

**Variables:** use `{{varName}}` in URL, headers, body — resolved from the active ZReq environment.

**Scripts in MCP args:** pass `preRequest` and `postResponse` as top-level strings (not nested under `scripts`) when using `collections_add_request` / `collections_update_request`.

## Common tasks

### Add a request to existing collection
```
collections_get { id }           → collectionId, updatedAt, folder ids
collections_add_request {
  collectionId, requestName, method, url,
  headers?, body?, parentFolderId?,
  expectedUpdatedAt
}
```

### Bootstrap workspace from OpenAPI spec
```
workspace_get_context { workspaceId }
collections_create { name, workspaceId }
collections_add_folder { collectionId, folderName }  (per tag/group)
collections_add_request { ... }                       (per endpoint)
environments_create { workspaceId, name, variables: [{ key, value }] }
```

### Update environment variables
```
environments_get { id }          → current variables + updatedAt
environments_update { id, variables: [...], expectedUpdatedAt }
```

## Safety rules

- Confirm `workspaceId` / `collectionId` with the user before destructive ops (`*_delete`).
- Do not delete workspaces or collections unless explicitly asked.
- Never commit or log OAuth tokens.
- `environments_update` with `variables` overwrites the full variable list — merge with existing values first.
- `collections_update` with `items` replaces the entire tree — prefer granular add/update tools.

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `needsAuth` | `mcp_auth` on that server, complete browser login |
| 401 after auth | Re-auth; check MCP OAuth client in ZReq Settings |
| `Parent folder not found` | Re-fetch collection; verify `parentFolderId` matches a folder `id` |
| `Request not found` | Re-fetch collection; verify `requestId` |
| Conflict / stale write | Re-read `updatedAt`, retry with fresh `expectedUpdatedAt` |
| `serverStatus: error` | Re-run `GetMcpTools pattern "zreq"`; pick another server or ask user to fix MCP config |
| No ZReq server found | Ask user to add ZReq MCP server in Cursor MCP settings |

## Additional resources

- Full tool parameter tables: [reference.md](reference.md)
