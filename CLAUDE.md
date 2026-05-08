# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Always use **pnpm** — never npm or yarn.

```bash
pnpm install          # Install dependencies
pnpm run start:dev    # Start in watch mode (loads .env)
pnpm run build        # Compile TypeScript
pnpm run lint         # Lint and auto-fix
pnpm run test         # Run unit tests (Jest, rootDir: src)
pnpm run test:e2e     # Run e2e tests
pnpm run test:cov     # Coverage report
pnpm run typecheck    # tsc --noEmit
pnpm run circular     # Detect circular dependencies (madge)
pnpm run audit        # pnpm audit
pnpm run prune        # Find unused exports (ts-prune)
pnpm run format       # Prettier write
pnpm run format:check # Prettier check
pnpm run check        # Run all checks in sequence
```

Run a single test file:

```bash
pnpm run test -- src/users/users.service.spec.ts
```

## Database

Local Postgres runs via Docker Compose (port **51214**, db: `ttc-postgres-db`):

```bash
docker compose up -d
pnpm prisma migrate dev --name <migration-name>   # Apply schema changes
pnpm prisma db pull --print                       # Introspect DB into schema
```

Prisma generates the client to `src/generated/prisma/` (not `node_modules`). After schema changes, regenerate with:

```bash
pnpm prisma generate
```

Required `.env` keys: `DATABASE_URL`, `SENTRY_DSN`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`.

Optional `.env` keys:

- `CLOCKIFY_API_URL` (defaults to `https://api.clockify.me/api/v1`)
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI` (defaults to `http://localhost:3000/hubspot/auth/callback`), `HUBSPOT_WEBHOOK_SECRET`
- `HUBSPOT_APP_ID` — HubSpot developer app ID; required for `POST /hubspot/webhooks/subscribe`
- `HUBSPOT_PRIVATE_APP_TOKEN` — HubSpot private app access token (developer portal); required for webhook subscription management
- `APP_ENCRYPTION_KEY` — 32-byte hex string for AES-256-GCM at-rest encryption of `clockifyApiKey`, `hubspotAccessToken`, `hubspotRefreshToken`. If absent, credentials are stored plaintext. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If adding to an existing DB, the repository's decrypt path falls back to plaintext on parse failure — existing rows remain readable.

## Architecture

**Stack**: NestJS 11 + Fastify, GraphQL (code-first, Apollo driver), Prisma 7 + `@prisma/adapter-pg`, Passport.js, Sentry, Swagger at `/api`.

**Module layout** — each domain module (`users`, `projects`, `auth`, `clockify`, `hubspot`) follows this layering:

- `*.resolver.ts` — GraphQL resolver (mutations/queries), delegates to service
- `*.controller.ts` — REST controller (used by `clockify` and `auth`), delegates to service
- `*.service.ts` — business logic, calls repository interface
- `repositories/*.repository.ts` — abstract class defining the data contract
- `repositories/prisma-*.repository.ts` — Prisma implementation of the abstract repo
- `entities/*.entity.ts` — GraphQL `@ObjectType` (used by resolver return types)
- `dto/*.input.ts` — GraphQL `@InputType` for mutations; plain class for REST body DTOs
- `types/*.type.ts` — plain TypeScript interface for internal model (not GraphQL)

**Dependency injection**: The abstract repository class is used as the DI token, bound to the Prisma implementation in the module's providers array:

```ts
{ provide: UserRepository, useClass: PrismaUserRepository }
```

**PrismaService** (`src/prisma.service.ts`) — extends `PrismaClient` directly, uses `PrismaPg` adapter for connection pooling. Inject it into repository implementations only, never into services or resolvers.

**Sentry** is initialized in `src/instrument.ts` which must be imported at the very top of `main.ts` (before any other NestJS bootstrapping) to instrument the runtime correctly.

## GraphQL

`GraphQLModule` is configured in `app.module.ts` with `ApolloDriver`. The context function exposes `{ req, res }` from Fastify so guards and resolvers can read/write cookies:

```ts
context: ({ request, reply }) => ({ req: request, res: reply });
```

The generated schema is written to `src/schema.gql` on startup.

## Auth Module (`src/auth/`)

Full auth system implemented with Passport.js. Layout:

```
src/auth/
├── auth.module.ts
├── auth.resolver.ts          — GraphQL: me, updateMe, login, register, logout, refreshToken, setupTwoFactor, enableTwoFactor, disableTwoFactor, verifyTwoFactor
├── auth.controller.ts        — REST: GET /auth/google, GET /auth/google/callback
├── auth.service.ts
├── strategies/
│   ├── local.strategy.ts     — passport-local (email + bcrypt password)
│   ├── jwt.strategy.ts       — passport-jwt, reads from HTTP-only cookie 'access_token'
│   └── google.strategy.ts    — passport-google-oauth20
├── guards/
│   ├── gql-auth.guard.ts     — extends AuthGuard('jwt'), overrides getRequest() for GraphQL context
│   ├── local-auth.guard.ts
│   └── roles.guard.ts
├── decorators/
│   ├── current-user.decorator.ts   — @CurrentUser() param decorator
│   └── roles.decorator.ts          — @Roles('ADMIN') decorator
├── repositories/
│   ├── auth.repository.ts          — abstract (DI token)
│   └── prisma-auth.repository.ts   — Prisma implementation
├── dto/
│   ├── login.input.ts
│   ├── register.input.ts
│   ├── verify-2fa.input.ts
│   └── update-me.input.ts      — UpdateMeInput { name?, email? } for updateMe mutation
└── types/
```

**TypeScript rules:**

- **No `any` type** — zero `any` in type annotations or casts. Use `unknown`, narrowed unions, or typed generics instead. The ESLint rules `no-unsafe-assignment`, `no-unsafe-return`, `no-unsafe-member-access`, `no-unsafe-argument`, and `no-unsafe-call` are all enabled and must pass.
- Where a third-party type is wider than needed (e.g. `configService.get()` returns `any` without a generic), always supply the generic: `configService.get<string>('KEY')`.
- Where a cast is unavoidable (e.g. cross-module structural mismatch), prefer `as unknown as TargetType` over `as any`.
- `catch (error)` blocks that ignore the error must use bare `catch {}` — never bind `error` unless you actually use it.
- `async` functions must contain at least one `await`; if there is none, remove `async` and return the value directly.
- Use `GqlContext` (from `src/auth/types/gql-context.type.ts`) when typing the GQL execution context in guards and decorators.
- Fastify request cookies are accessed via `(req.cookies as Record<string, string | undefined>)['key']`, not `req.cookies.key`, because the `cookies` property is added by `@fastify/cookie` module augmentation but individual keys are not typed.

**Key rules:**

- `LocalAuthGuard` cannot guard GraphQL mutations (passport-local reads `req.body`, not GQL args). Call `authService.validateUser()` directly in the login resolver.
- Always use `@UseGuards(GqlAuthGuard)` on protected queries/mutations. For role-restricted operations, chain `@UseGuards(GqlAuthGuard, RolesGuard)` + `@Roles('ADMIN')`.
- Never expose `password` or `twoFactorSecret` fields in GraphQL types.
- The `me` resolver must do a DB lookup (`authService.getUser(user.id)`) rather than returning `req.user` directly. The JWT payload only contains `{ id, email, role }` — returning it as `User` leaves `twoFactorEnabled` (non-nullable in the schema) as `undefined`, which propagates `null` up to the parent field and makes `data.me` null for every authenticated request.
- Cookie `path: '/'` must be set explicitly in `setCookie` and `clearCookie` calls. Without it, the browser scopes the cookie to the URL path that set it (e.g. `/auth/google/callback`), so subsequent requests to `/graphql` never include the cookie.
- `clearCookie` must pass `{ path: '/' }` to match the cookie that was set; omitting it clears a phantom cookie scoped to the request path instead.
- `FastifyReply` parameters in decorated controller methods must use `import type` to satisfy `isolatedModules` + `emitDecoratorMetadata`.
- Google OAuth uses REST endpoints (not GraphQL) because OAuth requires HTTP redirects.
- Passport.js calls Express-style `res.setHeader()` and `res.end()` during OAuth redirects, which Fastify's reply wrapper doesn't have. A Fastify `onRequest` hook in `main.ts` shims these methods onto every reply so Passport can operate.
- `PassportModule` must be registered with `{ session: false }` — otherwise Passport tries to call `req.logIn()` after the callback, which doesn't exist on Fastify requests.
- The Google callback controller must use `@Redirect()` + `@Res({ passthrough: true })`. Using `@Res()` without `passthrough: true` hands response control entirely to the handler, but in Fastify v5 the reply is not flushed before NestJS sends a 200. `passthrough: true` lets you set cookies on the reply while NestJS handles the actual redirect send.

**Token strategy:**

- Access token: 15 min JWT, HTTP-only cookie
- Refresh token: 7-day JWT, HTTP-only cookie; SHA-256 hash stored in `RefreshToken` table for server-side revocation and rotation

## Prisma Schema — Key Models

```
User           — id, email, name, password?, role (ADMIN/MANAGER/USER), twoFactorSecret?, twoFactorEnabled,
                 clockifyApiKey?, clockifyUserId?, clockifyWorkspaceId?,
                 hubspotAccessToken?, hubspotRefreshToken?, hubspotTokenExpiresAt?, hubspotPortalId?,
                 timestamps
RefreshToken   — tokenHash (SHA-256), userId, expiresAt
OAuthAccount   — provider, providerId, userId  (unique on [provider, providerId])
Project        — id, title, description, userId?
```

`UserRepository` exposes `updateHubspot(id, HubspotUpdate)` alongside `updateClockify` — both follow the same partial-update pattern and are the only way to write HubSpot token fields.

## Credential Encryption (`src/common/crypto.util.ts`)

`clockifyApiKey`, `hubspotAccessToken`, and `hubspotRefreshToken` are encrypted at rest with AES-256-GCM.

- **Key**: `APP_ENCRYPTION_KEY` in `.env` — 32-byte hex string. Must be set in all environments; without it, credentials are stored and returned plaintext.
- **Format stored in DB**: `iv:ciphertext:authtag` (all hex), single string per column.
- **Where**: encrypt on write and decrypt on read happen only in `PrismaUserRepository` (`updateClockify`, `updateHubspot`, `findById`, `findAll`). No other layer is aware of encryption.
- **Backward compat**: if the key is introduced on a DB that already has plaintext values, `decryptField` catches the parse error and returns the original string — existing rows remain readable.
- **Key rule**: never import `encrypt`/`decrypt` from `src/common/crypto.util.ts` outside `PrismaUserRepository`. Encryption is a repository-layer concern only.

## Clockify Module (`src/clockify/`)

Pure REST module — no GraphQL. All endpoints at `/clockify/*`, guarded by `AuthGuard('jwt')`.

```
src/clockify/
├── clockify.module.ts
├── clockify.controller.ts   — REST endpoints (see table below)
├── clockify.service.ts      — wraps Clockify REST API via native fetch; reads API key from user record
├── dto/
│   ├── set-credentials.dto.ts    — { apiKey: string; workspaceId?: string }
│   ├── start-time-entry.dto.ts   — { description?, projectId?, tagIds?, start?, billable? }
│   └── update-time-entry.dto.ts  — { start, end?, description?, projectId?, billable, tagIds[] }
└── types/
    ├── clockify-workspace.type.ts
    ├── clockify-project.type.ts
    ├── clockify-tag.type.ts       — { id, name, workspaceId, archived }
    └── time-entry.type.ts
```

**Endpoints:**

| Method   | Path                                      | Purpose                                                                                    |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET`    | `/clockify/status`                        | `{ connected: boolean; workspaceId: string \| null }`                                      |
| `POST`   | `/clockify/credentials`                   | Validate API key against Clockify, save key + `clockifyUserId` to user                     |
| `PATCH`  | `/clockify/workspace`                     | Update preferred workspace ID only (no re-validation)                                      |
| `GET`    | `/clockify/workspaces`                    | List user's Clockify workspaces                                                            |
| `GET`    | `/clockify/workspaces/:id/projects`       | List projects in workspace                                                                 |
| `GET`    | `/clockify/workspaces/:id/entries`        | List time entries (query: `start?`, `end?`)                                                |
| `GET`    | `/clockify/workspaces/:id/entries/active` | Running timer or `null`                                                                    |
| `POST`   | `/clockify/workspaces/:id/entries`        | Start new timer                                                                            |
| `PATCH`  | `/clockify/workspaces/:id/entries/stop`   | Stop running timer — no entry ID needed; calls Clockify `PATCH .../user/:uid/time-entries` |
| `PATCH`  | `/clockify/workspaces/:id/entries/:eid`   | Update entry (full replace) — calls Clockify `PUT /workspaces/{wsId}/time-entries/{eid}`   |
| `DELETE` | `/clockify/workspaces/:id/entries/:eid`   | Delete entry                                                                               |
| `GET`    | `/clockify/workspaces/:id/tags`           | List tags in workspace                                                                     |
| `POST`   | `/clockify/workspaces/:id/tags`           | Create new tag (`{ name }` body) — calls Clockify `POST /workspaces/{wsId}/tags`           |

**Key rules:**

- `ClockifyService` uses native `fetch` (no `@nestjs/axios`) — Node 18+ has `fetch` globally; `@types/node@24` types it.
- API key stored per-user in `User.clockifyApiKey` (plain text). Never expose the raw key in any response.
- `clockifyUserId` (Clockify's UUID for the user) is fetched from `GET /user` during `setCredentials` and stored in `User.clockifyUserId` — required for time entry list and stop endpoints.
- The private `request()` helper only sends `Content-Type: application/json` when a body is present. Body-less calls (DELETE, GET) omit the header — Fastify rejects `Content-Type: application/json` with no body as 400.
- The Clockify stop endpoint is `PATCH /workspaces/{wsId}/user/{userId}/time-entries` with `{ end: ISO }`. The `PUT .../time-entries/{id}` endpoint is for full updates; `PATCH .../time-entries/{id}` does not exist.
- For REST controllers, use `@Req() req: FastifyRequest & { user: RequestUser }` — no `@CurrentUser()` decorator (that only works in GraphQL context).
- `UsersModule` exports `UsersService` so `ClockifyModule` can import it.
- CORS in `main.ts` must include all needed methods explicitly: `['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`. The default `enableCors()` omits PATCH and DELETE.
- `PATCH entries/stop` (static segment) must be registered in the controller **before** `PATCH entries/:entryId` (dynamic). Fastify's radix tree gives static precedence regardless of registration order in theory, but NestJS registers routes in declaration order — declare the static route first to be safe.
- `ClockifyService.updateEntry` calls Clockify `PUT /workspaces/{wsId}/time-entries/{eid}` (full replace). Clockify has no `PATCH` for individual entries — only `PATCH /user/{uid}/time-entries` for stopping the active timer.

## HubSpot Module (`src/hubspot/`)

Pure REST module — no GraphQL. All CRM endpoints at `/hubspot/*`, guarded by `AuthGuard('jwt')`. OAuth endpoints are unguarded (OAuth redirect flow). Webhook endpoint is unguarded but HMAC-verified.

```
src/hubspot/
├── hubspot.module.ts
├── hubspot.controller.ts    — REST endpoints (OAuth + CRM proxy + webhooks)
├── hubspot.service.ts       — HubSpot API calls via native fetch; per-request token refresh
├── dto/
│   ├── create-contact.dto.ts    — { email, firstname?, lastname?, phone?, company? }
│   ├── update-contact.dto.ts    — Partial contact properties
│   ├── create-deal.dto.ts       — { dealname, amount?, dealstage?, pipeline?, closedate? }
│   └── update-deal.dto.ts       — Partial deal properties
└── types/
    ├── hubspot-contact.type.ts
    ├── hubspot-company.type.ts
    ├── hubspot-deal.type.ts
    └── hubspot-webhook.type.ts
```

**Endpoints:**

| Method   | Path                          | Auth          | Purpose                                                                    |
| -------- | ----------------------------- | ------------- | -------------------------------------------------------------------------- |
| `GET`    | `/hubspot/auth`               | JWT           | Redirect to HubSpot OAuth consent (HMAC-signed state)                      |
| `GET`    | `/hubspot/auth/callback`      | none          | Exchange code → tokens; store on user; redirect to frontend                |
| `GET`    | `/hubspot/status`             | JWT           | `{ connected, portalId }`                                                  |
| `DELETE` | `/hubspot/disconnect`         | JWT           | Clear tokens + revoke refresh token server-side (fire-and-forget)          |
| `GET`    | `/hubspot/contacts`           | JWT           | List contacts (`?after=`, `?limit=`)                                       |
| `POST`   | `/hubspot/contacts/search`    | JWT           | Search contacts (`{ filterGroups?, sorts?, properties?, limit?, after? }`) |
| `GET`    | `/hubspot/contacts/:id`       | JWT           | Single contact                                                             |
| `POST`   | `/hubspot/contacts`           | JWT           | Create contact                                                             |
| `PATCH`  | `/hubspot/contacts/:id`       | JWT           | Update contact                                                             |
| `GET`    | `/hubspot/companies`          | JWT           | List companies (`?after=`, `?limit=`)                                      |
| `POST`   | `/hubspot/companies/search`   | JWT           | Search companies                                                           |
| `GET`    | `/hubspot/companies/:id`      | JWT           | Single company                                                             |
| `GET`    | `/hubspot/deals`              | JWT           | List deals (`?after=`, `?limit=`)                                          |
| `POST`   | `/hubspot/deals/search`       | JWT           | Search deals                                                               |
| `GET`    | `/hubspot/deals/:id`          | JWT           | Single deal                                                                |
| `POST`   | `/hubspot/deals`              | JWT           | Create deal                                                                |
| `PATCH`  | `/hubspot/deals/:id`          | JWT           | Update deal                                                                |
| `POST`   | `/hubspot/associations`       | JWT           | Create association between two objects                                     |
| `POST`   | `/hubspot/webhooks/subscribe` | JWT + ADMIN   | Programmatically create HubSpot webhook subscription                       |
| `POST`   | `/hubspot/webhooks`           | HMAC (no JWT) | Receive HubSpot CRM events (HMAC + timestamp verified)                     |

**Key rules:**

- `HubspotService.request()` calls `getValidToken()` before every API call. If token expires within 5 min, it refreshes via `POST /oauth/v1/token` (grant_type=refresh_token) and saves new tokens before proceeding. Concurrent refresh calls for the same user are coalesced via a per-user `refreshLocks: Map<number, Promise<string>>` — only one refresh runs at a time.
- `HubspotService.request()` and `ClockifyService.request()` both use `fetchWithRetry` from `src/common/retry.util.ts` — retries up to 3 times on 429, honouring `Retry-After` header or using exponential backoff capped at 30 s.
- `disconnect(userId)` reads the refresh token before clearing the DB, then fire-and-forgets `DELETE /oauth/v1/refresh-tokens/:token` to revoke server-side. Never block disconnect on revocation failure.
- Association endpoint: `POST /hubspot/associations` calls `PUT /crm/v3/associations/{from}/{to}/batch/create`. Default `associationTypeId` is inferred for common pairs (contact→company: 1, contact→deal: 4). Pass `associationTypeId` explicitly for other pairs.
- OAuth `state` is a signed token: `base64url(JSON.stringify({ payload: JSON.stringify({ userId, nonce, exp }), sig: HMAC-SHA256(JWT_SECRET, payload) }))`. 10-min TTL. Verified in callback with `timingSafeEqual`. Never pass a bare `userId` integer as state.
- Webhook signature: `SHA256(HUBSPOT_WEBHOOK_SECRET + rawBody)`, compared via `timingSafeEqual`. `HUBSPOT_WEBHOOK_SECRET` left empty skips verification (dev convenience only).
- Webhook replay protection: `verifyWebhookSignature` checks `x-hubspot-request-timestamp` header; requests older than 5 minutes are rejected with 401.
- `main.ts` registers a custom `application/json` content-type parser that stores the raw body string on `req.rawBody` before parsing — needed for exact-byte HMAC verification. This replaces Fastify's built-in JSON parser but parses identically.
- `HubspotModule` imports `UsersModule` (which exports `UsersService`) — same pattern as `ClockifyModule`.
- Never expose `hubspotAccessToken` or `hubspotRefreshToken` in any response.
- HubSpot OAuth scopes required: `crm.objects.contacts.read/write`, `crm.objects.companies.read`, `crm.objects.deals.read/write`.

## Status & Known Gaps

- Microsoft OAuth is not implemented (no `passport-microsoft` strategy or controller endpoints).
- HubSpot webhook handler (`dispatchEvent`) logs events via NestJS Logger — add `switch` cases per `subscriptionType` for real business logic handlers.
- HubSpot company write operations (`POST /hubspot/companies`, `PATCH /hubspot/companies/:id`) are not implemented — read-only.
- HubSpot pagination FRONT: `HubspotPage` loads only the first page; "Load more" UI not yet wired.
- Audit log for third-party writes (#15) not yet implemented.

## Docs

Implementation logs live in `../docs/implementations/`:

- `auth-implementation.md` — backend auth system (Passport strategies, JWT, cookies, schema)
- `auth-ui.md` — frontend auth pages and routing
- `auth-remaining.md` — persistent redirect, cross-tab logout, resolver guards, disable 2FA, Apollo token refresh

Plans live in `../docs/plans/`:

- `clockify-integration.md` — Clockify REST integration design
- `auth-remaining.md` — plan for the auth follow-up items above
- `hubspot-upgrades.md` — HubSpot backend upgrades (associations, search, security, retry, refresh lock, webhook dispatch/subscription)
