# The Translator Companion — Backend

NestJS + Fastify backend for the TranslatorAssistant platform. Exposes a GraphQL API for core entities and REST endpoints for auth (OAuth) and Clockify time tracking.

## Stack

- **NestJS 11** on **Fastify v5**
- **GraphQL** (code-first, Apollo driver) — auto-generates `src/schema.gql`
- **Prisma 7** + PostgreSQL (`@prisma/adapter-pg`, client generated to `src/generated/prisma/`)
- **Passport.js** — local, JWT, and Google OAuth strategies
- **JWT** auth via HTTP-only cookies (access + refresh tokens)
- **2FA** — TOTP (speakeasy + QR code)
- **Clockify** — per-user time tracking via REST proxy (`/clockify/*`)
- **Swagger** — `http://localhost:3000/api`
- **Sentry** — tracing + profiling

## Prerequisites

- Node.js 18+, pnpm
- Docker (local database)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment** — create `.env` at the project root:

   ```env
   DATABASE_URL=postgresql://ttc-postgres-user:ttc-postgres-user@localhost:51214/ttc-postgres-db
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   COOKIE_SECRET=your_cookie_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   FRONTEND_URL=http://localhost:5173
   SENTRY_DSN=your_sentry_dsn
   # Optional — defaults to https://api.clockify.me/api/v1
   CLOCKIFY_API_URL=https://api.clockify.me/api/v1
   ```

3. **Start the database**

   ```bash
   docker compose up -d
   ```

4. **Run migrations**

   ```bash
   pnpm prisma migrate dev --name init
   ```

5. **Start the server**

   ```bash
   pnpm run start:dev
   ```

## Running

```bash
pnpm run start:dev    # watch mode (recommended)
pnpm run start        # single run
pnpm run start:prod   # production (requires prior build)
```

Server starts on `http://localhost:3000` by default (`PORT` env var overrides).

## Database

```bash
pnpm prisma migrate dev --name <migration-name>   # apply schema changes + regenerate client
pnpm prisma db pull --print                       # introspect DB into schema
pnpm prisma generate                              # regenerate client without migrating
```

## Quality checks

```bash
pnpm run typecheck      # TypeScript — tsc --noEmit
pnpm run circular       # circular dependency detection (madge)
pnpm run audit          # pnpm audit
pnpm run prune          # unused exports (ts-prune)
pnpm run format         # Prettier write
pnpm run format:check   # Prettier check
pnpm run lint           # ESLint with auto-fix
pnpm run check          # all of the above in sequence
```

## Tests

```bash
pnpm run test           # unit tests (Jest)
pnpm run test:watch     # watch mode
pnpm run test:cov       # coverage report
pnpm run test:e2e       # end-to-end tests
```

## API overview

| Layer                           | Path                                            | Transport          |
| ------------------------------- | ----------------------------------------------- | ------------------ |
| Auth (login, register, 2FA, me) | `/graphql`                                      | GraphQL            |
| Users, Projects                 | `/graphql`                                      | GraphQL            |
| Google OAuth                    | `GET /auth/google`, `GET /auth/google/callback` | REST               |
| Clockify proxy                  | `/clockify/*`                                   | REST (JWT-guarded) |
| Swagger docs                    | `/api`                                          | —                  |

### Clockify endpoints

All require a valid JWT cookie (`access_token`). Users must first `POST /clockify/credentials` with their personal Clockify API key.

| Method   | Path                                         | Purpose                               |
| -------- | -------------------------------------------- | ------------------------------------- |
| `GET`    | `/clockify/status`                           | Connection status + default workspace |
| `POST`   | `/clockify/credentials`                      | Save + validate Clockify API key      |
| `PATCH`  | `/clockify/workspace`                        | Update default workspace              |
| `GET`    | `/clockify/workspaces`                       | List workspaces                       |
| `GET`    | `/clockify/workspaces/:id/projects`          | List projects                         |
| `GET`    | `/clockify/workspaces/:id/entries`           | List time entries                     |
| `GET`    | `/clockify/workspaces/:id/entries/active`    | Running timer                         |
| `POST`   | `/clockify/workspaces/:id/entries`           | Start timer                           |
| `PATCH`  | `/clockify/workspaces/:id/entries/:eid/stop` | Stop timer                            |
| `DELETE` | `/clockify/workspaces/:id/entries/:eid`      | Delete entry                          |
