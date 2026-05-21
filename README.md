# The Translator Companion — Backend

NestJS + Fastify backend for the TranslatorAssistant platform. Exposes a GraphQL API for core business entities (clients, projects, tasks, time entries, invoices) and REST endpoints for auth (OAuth), Clockify time tracking, and HubSpot CRM.

## Stack

- **NestJS 11** on **Fastify v5**
- **GraphQL** (code-first, Apollo driver) — auto-generates `src/schema.gql`
- **Prisma 7** + PostgreSQL (`@prisma/adapter-pg`, client generated to `src/generated/prisma/`)
- **Passport.js** — local, JWT, and Google OAuth strategies
- **JWT** auth via HTTP-only cookies (access + refresh tokens)
- **2FA** — TOTP (speakeasy + QR code)
- **Clockify** — per-user time tracking via REST proxy (`/clockify/*`)
- **HubSpot** — per-user CRM via OAuth + REST proxy (`/hubspot/*`)
- **pdf-lib** — server-side invoice PDF generation (`GET /invoices/:id/pdf`)
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

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in the required secrets — startup aborts if any are missing:

   | Variable                                              | How to get it                                                               |
   | ----------------------------------------------------- | --------------------------------------------------------------------------- |
   | `APP_ENCRYPTION_KEY`                                  | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`  |
   | `JWT_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` | Any random string ≥ 32 chars                                                |
   | `DATABASE_URL`                                        | Pre-filled — matches the Docker Compose service                             |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`           | [Google Cloud Console](https://console.cloud.google.com/) OAuth credentials |
   | `SENTRY_DSN`                                          | Sentry project DSN (optional — app still starts without it)                 |

   HubSpot and SMTP keys are optional — leave blank for local dev.

3. **Start the database and Redis**

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

| Layer                                        | Path                                            | Transport                                                                         |
| -------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Auth (login, register, 2FA, me, updateMe)    | `/graphql`                                      | GraphQL (login/register/requestPasswordReset/resetPassword throttled: 5 req/60 s) |
| Users, Clients, Projects, Tasks, TimeEntries | `/graphql`                                      | GraphQL (global throttle: 100 req/60 s)                                           |
| Invoices (CRUD + status transitions)         | `/graphql`                                      | GraphQL                                                                           |
| Real-time timer                              | `ws://…/graphql` (`timerUpdated` subscription)  | WebSocket (`graphql-ws`; JWT cookie auth at connect)                              |
| Invoice PDF download                         | `GET /invoices/:id/pdf`                         | REST (JWT-guarded) — multi-page, logo embed from `User.logoUrl`                   |
| Google OAuth                                 | `GET /auth/google`, `GET /auth/google/callback` | REST                                                                              |
| Clockify proxy                               | `/clockify/*`                                   | REST (JWT-guarded)                                                                |
| HubSpot CRM proxy                            | `/hubspot/*`                                    | REST (JWT-guarded + OAuth flow)                                                   |
| Swagger docs                                 | `/api`                                          | —                                                                                 |

### Core GraphQL entities (step 1.3)

| Entity      | Queries                                              | Mutations                                                                                                   |
| ----------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `User`      | `users` (ADMIN), `user(id)` (ADMIN)                  | `createUser` (ADMIN), `updateUser` (ADMIN — includes `role`), `removeUser` (ADMIN)                          |
| `Client`    | `clients`, `client(id)`                              | `createClient`, `updateClient`, `deleteClient`                                                              |
| `Project`   | `projects(status?)`, `project(id)`                   | `createProject`, `updateProject`, `deleteProject`                                                           |
| `Task`      | `tasks(projectId)`, `myTasks`                        | `createTask`, `updateTask`, `deleteTask`                                                                    |
| `TimeEntry` | `timeEntries(start?,end?,projectId?)`, `activeTimer` | `startTimer`, `stopTimer`, `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`                          |
| `Invoice`   | `invoices(status?)`, `invoice(id)`                   | `createInvoice`, `generateInvoice`, `updateInvoice`, `deleteInvoice`, `addInvoiceItem`, `removeInvoiceItem` |
| `Rate`      | `rates(type?)`, `rate(id)`                           | `createRate`, `updateRate`, `deleteRate`                                                                    |

**Status enums:**

| Enum            | Values                                              | Default    |
| --------------- | --------------------------------------------------- | ---------- |
| `ProjectStatus` | `DRAFT` `ACTIVE` `COMPLETED` `CANCELLED` `ARCHIVED` | `DRAFT`    |
| `TaskStatus`    | `TODO` `IN_PROGRESS` `DONE`                         | `TODO`     |
| `InvoiceStatus` | `DRAFT` `SENT` `PAID` `OVERDUE` `CANCELLED`         | `DRAFT`    |
| `RateType`      | `HOURLY` `PER_WORD` `FIXED`                         | (required) |

**Invoice status transitions:** `DRAFT→SENT/CANCELLED`, `SENT→PAID/OVERDUE`, `OVERDUE→PAID`. Transitions outside this map throw `400`. Transitioning to `SENT` auto-sets `issuedAt`; to `PAID` auto-sets `paidAt`.

### Clockify endpoints

All require a valid JWT cookie (`access_token`). Users must first `POST /clockify/credentials` with their personal Clockify API key.

| Method   | Path                                      | Purpose                                                                                         |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`    | `/clockify/status`                        | Connection status + default workspace                                                           |
| `POST`   | `/clockify/credentials`                   | Save + validate Clockify API key                                                                |
| `PATCH`  | `/clockify/workspace`                     | Update default workspace                                                                        |
| `GET`    | `/clockify/workspaces`                    | List workspaces                                                                                 |
| `GET`    | `/clockify/workspaces/:id/projects`       | List projects                                                                                   |
| `GET`    | `/clockify/workspaces/:id/entries`        | List time entries (`?start=` `?end=`)                                                           |
| `GET`    | `/clockify/workspaces/:id/entries/active` | Running timer or `null`                                                                         |
| `POST`   | `/clockify/workspaces/:id/entries/import` | Import Clockify entries into TTC (`{ start, end }` ISO range) — returns `{ imported, skipped }` |
| `POST`   | `/clockify/workspaces/:id/entries`        | Start timer                                                                                     |
| `PATCH`  | `/clockify/workspaces/:id/entries/stop`   | Stop running timer (no entry ID needed)                                                         |
| `PATCH`  | `/clockify/workspaces/:id/entries/:eid`   | Update entry (description, project, tags, billable, times)                                      |
| `DELETE` | `/clockify/workspaces/:id/entries/:eid`   | Delete entry                                                                                    |
| `GET`    | `/clockify/workspaces/:id/tags`           | List tags                                                                                       |
| `POST`   | `/clockify/workspaces/:id/tags`           | Create tag (`{ name }`)                                                                         |

### HubSpot endpoints

OAuth endpoints redirect — no JWT needed. All CRM endpoints require a valid JWT cookie (`access_token`). Connect via `GET /hubspot/auth` first.

| Method   | Path                                  | Auth        | Purpose                                                  |
| -------- | ------------------------------------- | ----------- | -------------------------------------------------------- |
| `GET`    | `/hubspot/auth`                       | JWT         | Redirect to HubSpot OAuth consent                        |
| `GET`    | `/hubspot/auth/callback`              | none        | OAuth callback — exchanges code, saves tokens, redirects |
| `GET`    | `/hubspot/status`                     | JWT         | `{ connected, portalId }`                                |
| `DELETE` | `/hubspot/disconnect`                 | JWT         | Clear HubSpot tokens                                     |
| `GET`    | `/hubspot/contacts`                   | JWT         | List contacts (`?after=` `?limit=`)                      |
| `GET`    | `/hubspot/contacts/:id`               | JWT         | Single contact                                           |
| `POST`   | `/hubspot/contacts`                   | JWT         | Create contact                                           |
| `PATCH`  | `/hubspot/contacts/:id`               | JWT         | Update contact                                           |
| `POST`   | `/hubspot/contacts/:id/import-client` | JWT         | Import contact as TTC Client (idempotent by `hubspotId`) |
| `GET`    | `/hubspot/companies`                  | JWT         | List companies                                           |
| `GET`    | `/hubspot/companies/:id`              | JWT         | Single company                                           |
| `POST`   | `/hubspot/companies`                  | JWT         | Create company                                           |
| `PATCH`  | `/hubspot/companies/:id`              | JWT         | Update company                                           |
| `GET`    | `/hubspot/admin/connections`          | JWT + ADMIN | List all users + HubSpot connection status               |
| `DELETE` | `/hubspot/admin/connections/:userId`  | JWT + ADMIN | Force-disconnect a user's HubSpot tokens                 |
| `GET`    | `/hubspot/deals`                      | JWT         | List deals                                               |
| `GET`    | `/hubspot/deals/:id`                  | JWT         | Single deal                                              |
| `POST`   | `/hubspot/deals`                      | JWT         | Create deal                                              |
| `PATCH`  | `/hubspot/deals/:id`                  | JWT         | Update deal                                              |
| `POST`   | `/hubspot/webhooks`                   | HMAC        | Receive HubSpot CRM events (HMAC-verified, no JWT)       |

### Audit log endpoints

| Method | Path           | Auth        | Purpose                                            |
| ------ | -------------- | ----------- | -------------------------------------------------- |
| `GET`  | `/admin/audit` | JWT + ADMIN | Audit log (`?userId=` `?limit=` — default last 50) |

Every mutating call to HubSpot, Clockify, Clients, Projects, or Invoices writes a fire-and-forget `AuditLog` row. Never blocks the request.

| Service         | Logged actions                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HubspotService  | `HUBSPOT_CREATE_CONTACT`, `HUBSPOT_UPDATE_CONTACT`, `HUBSPOT_CREATE_COMPANY`, `HUBSPOT_UPDATE_COMPANY`, `HUBSPOT_CREATE_DEAL`, `HUBSPOT_UPDATE_DEAL`, `HUBSPOT_CREATE_ASSOCIATION`, `HUBSPOT_IMPORT_CLIENT` |
| ClockifyService | `CLOCKIFY_START_ENTRY`, `CLOCKIFY_STOP_ENTRY`, `CLOCKIFY_UPDATE_ENTRY`, `CLOCKIFY_DELETE_ENTRY`, `CLOCKIFY_IMPORT_ENTRIES`                                                                                  |
| ClientsService  | `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE`                                                                                                                                                           |
| ProjectsService | `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_DELETE`                                                                                                                                                        |
| InvoicesService | `INVOICE_CREATE`, `INVOICE_STATUS_CHANGE` (includes `from`/`to` status), `INVOICE_DELETE`                                                                                                                   |
