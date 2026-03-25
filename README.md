# ZReq API

Backend for **[ZReq](../client/README.md)** — the workspace-first HTTP client. This NestJS service stores users, workspaces, collections (request trees as JSON), and environments; it powers authentication (including GitHub OAuth) and everything the desktop or web client syncs against.

<p align="center">
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/Nest.js-11-E0234E?style=flat&logo=nestjs" alt="Nest.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript" alt="TypeScript"></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat&logo=prisma" alt="Prisma"></a>
  <a href="https://www.mysql.com/"><img src="https://img.shields.io/badge/MySQL-8-4479A1?style=flat&logo=mysql" alt="MySQL"></a>
</p>

---

## What it does

- **Auth** — `POST /auth/register`, `POST /auth/login`, JWT-based sessions, **GitHub OAuth** (`GET /auth/github`, callback, HTML redirect for web and custom `zreq://` deep links for Tauri).
- **Workspaces** — CRUD plus **members** (invite existing users by email): `GET/POST /workspaces`, `GET/POST/DELETE .../members`, etc.
- **Collections** — Per-workspace folders/requests stored as **JSON** (`items`): list, get, create, update, delete under `/collections`.
- **Environments** — Named environments with **variables** (key/value, enabled flag): `/environments`.
- **Users** — User management endpoints under `/users` (used by the stack as needed).
- **Health** — `GET /health` returns `{ ok: true, service: 'zreq-api' }` so the client can verify a base URL during instance setup.

There is **no global `/api` prefix** (see `src/main.ts`). CORS is enabled for all origins; adjust for production. Request body size defaults to **50MB** (configurable via `BODY_LIMIT`) so large Postman-style imports do not hit `413`.

---

## Stack

| Layer | Choice |
|--------|--------|
| Framework | NestJS 11 |
| ORM | Prisma 7 (client output: `prisma/generated`) |
| Database | MySQL via `@prisma/adapter-mariadb` / `mariadb` driver |
| Validation | Zod + `nestjs-zod` (global pipe & serializer) |

---

## Project layout

```
src/
├── config/
│   ├── prisma/          # PrismaModule & PrismaService
│   └── exception/       # Global filters (e.g. 404)
├── features/
│   ├── auth/
│   ├── users/
│   ├── workspaces/
│   ├── collections/
│   └── environments/
├── health/              # GET /health
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

---

## Prerequisites

- Node.js (LTS)
- MySQL or MariaDB
- `pnpm` (lockfile present; `npm` / `yarn` work if you prefer)

---

## Docker

Full stack (MySQL + API). On container start, `prisma migrate deploy` runs before the app (override with `SKIP_MIGRATIONS=1` if needed).

```bash
cd backend
docker compose up --build
```

Defaults: API **http://localhost:3001** → container **3000**; MySQL **localhost:3306**. To change only the API port on your machine, set **`API_PORT`** in `backend/.env`. Also set `SECRET`, `MYSQL_ROOT_PASSWORD`, `DATABASE_URL`, OAuth, etc.

- **`DATABASE_URL`** inside Compose must use host **`db`** (the database service name), e.g. `mysql://root:YOUR_PASSWORD@db:3306/zreq`, matching `MYSQL_ROOT_PASSWORD` / `MYSQL_DATABASE`.
- **`docker build`** / **`docker run`** for the API image only:

```bash
docker build -t zreq-api .
docker run --rm -e DATABASE_URL="mysql://..." -e SECRET="..." -e PORT=3000 -p 3001:3000 zreq-api
```

Change the left side of `-p` for the host port; keep `PORT` and the right side of `-p` in sync if you change the in-container listen port.

---

## Setup

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL, SECRET, PORT, and GitHub OAuth vars if you use GitHub sign-in
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm run start:dev
```

The server listens on **`PORT`** (defaults to **3000** in code if unset). Align this with your client’s `VITE_API_URL` and with `GITHUB_CALLBACK_URL` / `FRONTEND_OAUTH_URL` in `.env.example`.

Useful Prisma commands:

```bash
pnpm exec prisma generate    # After schema changes
pnpm exec prisma migrate dev  # Create & apply migrations
pnpm exec prisma studio       # Database GUI
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm run start:dev` | Dev server (watch) |
| `pnpm run start:prod` | Production (`node dist/src/main.js` after build) |
| `pnpm run build` | Compile to `dist/` |
| `pnpm run lint` | ESLint |
| `pnpm run test` | Unit tests |
| `pnpm run test:e2e` | E2E tests |

---

## Environment variables

See **`.env.example`** for the full list. Highlights:

- **`DATABASE_URL`** — MySQL connection string  
- **`SECRET`** — JWT / crypto secret  
- **`PORT`** — HTTP port  
- **`BODY_LIMIT`** — Optional; overrides default large JSON limit  
- **`GITHUB_*` / `FRONTEND_OAUTH_URL`** — GitHub OAuth and post-login redirect (web hash vs `zreq://` for desktop)

---

## MCP Server (AI Agent)

This backend now includes an MCP server built with `@rekog/mcp-nest` using:

- **Transport**: Streamable HTTP (`/mcp`) — recommended for Claude custom connector
- **Auth**: OAuth 2.1 Authorization Code + PKCE (internal/local provider)

### MCP endpoints

- **MCP (Streamable HTTP)**: `/mcp`
- **Authorize**: `GET /mcp/oauth/authorize`
- **Callback**: `GET /mcp/oauth/callback`
- **Token**: `POST /mcp/oauth/token`
- **Dynamic client registration**: `POST /mcp/oauth/register`
- **Well-known metadata** endpoints are also exposed by MCP-Nest.

### MCP scopes

- `profile:read`
- `collections:read`, `collections:write`
- `environments:read`, `environments:write`
- `workspaces:read`, `workspaces:write`

### MCP tools

- `collections_*`: list/get/create/update/delete collections
- `environments_*`: list/get/create/update/delete environments
- `workspaces_*`: list/create/update/delete workspace + members management
- `system_health`, `auth_whoami`, `workspaces_accessible_ids`

### Required env vars for MCP

Set these in `.env` (see `.env.example`):

- `MCP_SERVER_URL` (public backend URL used in OAuth metadata)
- `MCP_*_ENDPOINT` and `MCP_OAUTH_*_PATH` (optional path overrides)
- `MCP_GITHUB_CLIENT_ID` and `MCP_GITHUB_CLIENT_SECRET` (or fallback to `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`)
- `MCP_JWT_SECRET` (or fallback to `SECRET`)

### Internal OAuth setup reminder

Set these vars to identify MCP user for OAuth login:

- `MCP_DEFAULT_USER_EMAIL` (required for auto-login flow)
- `MCP_DEFAULT_USER_NAME` (optional display name)

Optional per-request override during authorize step:

- `x-mcp-user-email` header or `login_hint` query parameter

---

## Disclaimer — *vibe coding* project

This API is built alongside an experimental client: schemas, endpoints, and auth flows may change quickly. It is **not** offered as a hardened, audited production platform. Run your own security review, tighten CORS and secrets for real deployments, and do not treat this as a compliance-ready backend without your own checks.

---

*Pairs with the ZReq client — sync, workspaces, and OAuth assume this service (or a compatible fork) is running.*
