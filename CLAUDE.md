# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 11 + Fastify v5, GraphQL (code-first, Apollo), Prisma 8 (`@prisma/orm-postgres`; Prisma 7 CLI kept only for the migration handover) + PostgreSQL, Redis (throttler + pub/sub), JWT via HTTP-only cookies.

## Working rules

- Never start or stop the dev server (`pnpm run start:dev`) yourself. The operator runs it. Do not run/verify against it unless the operator explicitly asks — rely on `pnpm run test`/`pnpm run check` instead.
- **Swagger docs are mandatory for every REST change** — see below. Not optional, not a follow-up task. A PR touching a `*.controller.ts` or its DTOs is incomplete without it.

## Commands

```bash
# Dev
pnpm run start:dev          # watch mode (requires .env + docker compose up -d)
docker compose up -d        # start postgres + redis

# DB (queries on Prisma 8; schema changes still Prisma 7 migrations until release B, see "Prisma 7 / 8" below)
pnpm prisma7 migrate dev --name <name> --config prisma7.config.ts   # schema change: edit prisma/schema.prisma AND prisma8/contract.prisma
pnpm prisma contract emit                                           # re-emit generated/prisma8/ after editing prisma8/contract.prisma
pnpm run prisma:miggen                                              # deploy: prisma7 migrate deploy + generate, then prisma db sign --no-advance-ref

# Quality (run all at once)
pnpm run check              # typecheck + circular + audit + prune + format:check + lint

# Individual checks
pnpm run typecheck          # tsc --noEmit
pnpm run circular           # madge circular dep detection
pnpm run prune              # ts-prune unused exports
pnpm run lint               # ESLint --fix

# Tests
pnpm run test               # unit (Jest, files: src/**/*.spec.ts)
pnpm run test:watch
pnpm run test:e2e           # config: test/jest-e2e.json
pnpm run test:integration   # real Postgres (ttc_test), *.int-spec.ts
pnpm run test:mutation --mutate <files>  # StrykerJS over the integration tests, incremental, one at a time (shared test DB)
```

## Working process

Test-first, always. Red → green → refactor:

1. Write failing spec first (unit test for services/resolvers; e2e for endpoints). Confirm it fails for right reason.
2. Write minimal code to pass it.
3. Refactor under green tests.

No prod code without a preceding failing test. Applies to bug fixes too — reproduce as failing test before patching.

### Principles

- **KISS** — simplest thing that works. No speculative abstraction.
- **DRY** — extract shared logic once duplication appears twice, not before.
- **Hexagonal (ports & adapters)** — domain/service logic depends on abstractions, not Prisma/HTTP/Redis directly. Existing `repositories/<name>.repository.ts` (abstract) + `repositories/prisma-<name>.repository.ts` (adapter) pattern is the port/adapter boundary — extend it for new external deps rather than reaching for Prisma client in services directly.
- **SOLID** — one reason to change per class (S); extend via new providers/strategies not edits to existing ones where feasible (O); mocks/impls substitutable behind repository abstractions (L); slim focused interfaces not fat ones (I); depend on `XRepository` abstraction, inject concrete via module `useClass` (D).
- **ACID** — multi-step DB writes that must be atomic go in a Prisma `$transaction`. Never leave related writes (e.g. entity + audit trail that must be consistent) split across unguarded awaits.
- **TDD** — see test-first workflow above; drives design, not just verification.
- **BDD** — spec `describe`/`it` blocks read as behavior ("delegates to service with user id", not "test1"). Favor given/when/then structuring in complex specs.
- **DDD** — module boundaries in `src/<feature>/` mirror domain boundaries (Projects, Tasks, Invoices, Rates...). Entities carry domain rules, not just data shape; keep cross-module reach-through to a minimum (go through the other module's service, not its repository).

## Architecture

### Module structure

Each feature lives in `src/<feature>/` with: `*.module.ts`, `*.resolver.ts` (GraphQL), `*.service.ts`, `*.controller.ts` (REST if any), `entities/`, `dto/`, `repositories/`.

Repository pattern used throughout: abstract class in `repositories/<name>.repository.ts`, Prisma impl in `repositories/prisma-<name>.repository.ts`. Modules bind via `{ provide: XRepository, useClass: PrismaXRepository }`.

### Auth flow

- JWT access token (15m) + refresh token stored as HTTP-only cookies
- Passport strategies: `local`, `jwt`, `google-oauth20`
- Guards: `GqlAuthGuard` (resolvers), `JwtAuthGuard` (REST), `RolesGuard` (RBAC via `@Roles()` decorator)
- 2FA: TOTP (speakeasy) + backup codes; both stored hashed
- Session events (login/logout/token-refresh broadcasts) via SSE through `AuthEventsService` backed by Redis pub/sub — replaces previous WebSocket approach
- Auth repository pattern: `AuthRepository` → `PrismaAuthRepository` for testability

### REST API documentation (Swagger) — mandatory on every change

Swagger UI lives at `/api`, built from `DocumentBuilder` config in `src/main.ts` plus decorators on controllers/DTOs. GraphQL resolvers can't be introspected by `@nestjs/swagger` (single `POST /graphql` endpoint, not a REST resource tree) — `src/main.ts`'s `documentFactory` manually stubs one `/graphql` path pointing at `src/schema.gql` and the Apollo Sandbox, so `/api` doesn't silently omit the core domain API. Don't try to expand that stub into per-query/mutation entries — `src/schema.gql` + Sandbox introspection is the real GraphQL doc surface. The stub's description is deliberately generic (no module names) so it never needs updating when a new top-level GraphQL module ships — don't reintroduce a per-module enumeration there.

The `@nestjs/swagger` CLI plugin is enabled in `nest-cli.json` (`introspectComments: true`) — it auto-infers each DTO field's `type`/`required` from the TS AST, so raw field shape always shows up even with zero decorators. That covers _shape_, not _meaning_ — decorators below are still required by hand:

Any commit that adds/changes a REST endpoint or its DTO **must** also add/update:

- **Controller** (one-time per controller, not per endpoint):
  - `@ApiTags('<feature>')` on the class
  - `@ApiCookieAuth('access_token')` on the class if every route needs auth, or per-method if mixed (auth is an HTTP-only JWT cookie — **not** Bearer, don't add `@ApiBearerAuth`)
- **Every endpoint method:**
  - `@ApiOperation({ summary: '...' })` — one line, states what it does and any access restriction (e.g. "ADMIN only", "owner only")
  - `@ApiParam(...)` for each path param, `@ApiQuery(...)` for each query param
  - `@ApiExcludeEndpoint()` for routes not meant to be called directly by API clients (OAuth provider callbacks, webhook receivers verified by HMAC not JWT, debug routes) — exclude with a one-line comment explaining why, don't just leave undocumented
  - `@ApiConsumes`/`@ApiBody` with an explicit schema for multipart/file uploads or inline (non-DTO-class) request bodies
- **Every DTO field:** `@ApiProperty({ description, example })` (or `@ApiPropertyOptional`-equivalent via `required: false`) — the plugin gives the type, but description + example are never inferred and must be written. `nullable: true` for fields typed `X | null`.
- **Nested request shapes:** if a DTO field's type is a plain inline object/union (not a class), promote it to its own exported class with its own `@ApiProperty`s — plain TS types don't generate schema refs, only classes do. String-literal unions become `enum: [...]` on the property, not a bare `string`.

Rationale: this is the only REST surface documentation that exists in the repo — no separate API reference doc, no Postman collection. If it's not in the decorators, it's not documented anywhere.

### GraphQL schema

`src/schema.gql` is **auto-generated** — never edit it directly. Edit the TypeScript entity/resolver files, then restart the server to regenerate.

Orphaned union types (`TranslatorOccupation`, `CorrectorOccupation`, `CustomOccupation`) registered explicitly in `AppModule.buildSchemaOptions.orphanedTypes` — required because NestJS code-first won't include types not reachable from root resolvers.

Naming: `Occupation` (`src/occupations/`, table `Occupation`) is the user's business line (translator, corrector...) — renamed from `Activity` in migration `20261006120000_rename_activity_to_occupation`. `TaskActivity` (`src/tasks/activities.service.ts`, the `activities` field on `Task`/`TimeEntry`) is the unrelated task history log and keeps its name.

Query depth capped via `graphql-depth-limit` (`validationRules` in `GraphQLModule.forRootAsync`, `src/app.module.ts`) — `GRAPHQL_MAX_DEPTH` env var, default 10. Prevents an unbounded nested query over the Client → Project → Task → {Subtask, Comment, Activity, Attachment, TimeEntry} graph.

### GraphQL field resolvers — ownership + DataLoader (mandatory pattern)

Every `@ResolveField()` must independently re-derive scope from the current user, the same as top-level queries — never trust that the parent query already filtered correctly. Nested relations that don't carry their own `userId` (`Subtask`, `TaskComment`, `TaskLabel`, `TaskAttachment`, `TaskActivity`) scope through the parent `Task`'s ownership check (`task: { OR: [{ project: { userId } }, { assigneeId: userId } ] } }`, mirroring `prisma-task.repository.ts`'s `findById`); relations with their own direct owner (`ClientStatusHistory` via `client.userId`, `TimeEntry`-linked `TaskActivity` via `timeEntry.userId`) scope through that instead. Aggregates (`Project.totalTimeSeconds`, `Task.totalTimeSeconds`) sum **all** contributors' data, not just the requesting user's own rows — the `userId` only gates _access_ to the parent resource, it must never also restrict which rows get aggregated.

Field resolvers must go through the per-request `GqlLoaders` (`@Context() ctx: GqlContext`, `ctx.loaders.<name>.load(id)`) rather than calling a service directly — calling a service per-row reintroduces N+1. Loaders are built in `LoadersService.createLoaders()` (`src/common/graphql/loaders.service.ts`), wired into the GraphQL context in `app.module.ts`'s `GraphQLModule.forRootAsync`. Adding a new field resolver that fetches by parent id: add a batch method (`findByXIds(ids, userId)`) to the relevant repository (scoped per the ownership rules above), wire a loader for it in `LoadersService` using `createGroupedListLoader`/`createMappedValueLoader` (`src/common/graphql/batch-loader.util.ts`), then call `ctx.loaders.<name>.load(id)` from the resolver — don't call the service/repository directly from a field resolver.

### Real-time (SSE)

`TimerEventsService` and `AuthEventsService` both build on shared infra in `src/common/realtime/`: `createRedisClientPair()` (each service still constructs its own publisher/subscriber pair — not a shared singleton) and `RealtimeChannelRegistry<T>` (ref-counted Redis pub/sub channel registry with a `gated` option — `true` for timer's staged subscribing/active/cleaning lifecycle with a delivery gate, `false` for auth's simpler immediate-delivery/immediate-cleanup behavior; don't unify these two modes, they're intentionally different). Controllers write the SSE HTTP response via the shared `writeSseStream()` helper (`src/common/realtime/sse-stream.util.ts`). Timer state/auth events published through Redis so multiple server instances stay in sync. Not migrated to GraphQL subscriptions — one-way server push with no client-to-server messages needed, SSE is the right transport for both (see `docs/final-arch.txt`).

### Encryption

Third-party credentials (Clockify API key, HubSpot/Google Calendar OAuth tokens) encrypted at rest using `APP_ENCRYPTION_KEY` (32-byte hex → 64 char string) via `src/common/crypto.util.ts`. HubSpot's and Google Calendar's OAuth access-token refresh (expiry check, concurrent-refresh coalescing, token-endpoint exchange) shares `OAuthTokenRefreshService` (`src/common/oauth-token/`) — each provider still owns its own failure/success handling (Google clears credentials on `invalid_grant` and conditionally preserves the refresh token if not reissued; HubSpot always overwrites both tokens) via callbacks passed into `refresh()`, so provider-specific behavior stays provider-specific. Clockify uses a static API key, no refresh logic needed.

### Audit log

Fire-and-forget `AuditLog` writes in HubSpot, Clockify, Clients, Projects, and Invoices services. Never `await` these — they must not block requests. Retention cleaned by scheduled job in `CleanupModule` (`AUDIT_RETENTION_DAYS`, default 90).

`GET /admin/audit` (`src/audit/audit.controller.ts`) — **UNUSED**. No active consumer. It's the one REST endpoint left over from before the GraphQL admin surface existed (see `docs/final-arch.txt` §4); migrating it to `admin.resolver.ts` was considered and explicitly deprioritized (`docs/arch-todo.txt` item 4). Leave as-is, don't spend effort on it.

### Prisma 7 / 8

Upgrade following Prisma's 7 -> 8 guide (https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql). Every repository, service and script now runs on Prisma 8 (`Prisma8Service`, one client app-wide via the `@Global` `Prisma8Module`). Release A (current `prisma:miggen`) still applies pending Prisma 7 migrations, then `prisma db sign --no-advance-ref` adopts the database for Prisma 8 (refuses on drift, exit 4). Release B removes Prisma 7 (the `Prisma*Repository` v7 classes, `PrismaService`, `@prisma/client`, `@prisma/adapter-pg`, `@prisma/prisma7`) and switches `prisma:miggen` to `prisma db migrate`; deploy it only after release A ran on every database.

Until release B, a schema change is a Prisma 7 migration AND the same change in `prisma8/contract.prisma` + `pnpm prisma contract emit`, or `db sign` will refuse. Never run `prisma db init` / `db update` against a real database. Pin `@prisma/orm-postgres` to the `@prisma/orm-toolchain` version the `prisma` CLI depends on (`pnpm view prisma@<v> dependencies`): a mismatched pair crashes `contract infer`/`emit` with "Malformed authoring pslBlock contribution". Port plan: `../docs/plans/step1.25/prisma8-port.md` (phases A-E). Port conventions:

- Client: inject `Prisma8Service` (`src/prisma8/`), query via `this.db.orm.public.<Model>`.
- Timestamps: the contract types every `timestamp(3)` column as `TimestampString(3)` (no `Temporal`, no polyfill). Convert at the repository boundary with `fromDb`/`toDb` (`src/prisma8/timestamp.ts`); the app keeps using `Date`. No automatic `updatedAt` on Postgres: set it on every update.
- Relation field names in `prisma8/contract.prisma` match `prisma/schema.prisma` (`contacts`, `items`, `tags`...); keep them aligned.
- Case-insensitive search: `.ilike(...)` (escape `%`/`_` in user input). Transactions: `db.transaction(async (tx) => ...)`. Decimals come back as strings: `Number(...)` where Prisma 7 code called `.toNumber()`.
- Single-row `where(...).update()` / `.delete()` with a missing or empty filter silently hits one arbitrary row (the lowest id): in tests, never make the target the first row, so a dropped filter fails. One `Prisma8Module` (`@Global`) provides the single `Prisma8Service`; repositories inject it, modules don't list it.
- Mutation testing: `stryker.config.json` points `tsconfigFile` at a missing file on purpose (TypeScript 7 has no JS compiler API; Stryker only needs it to rewrite tsconfig references) and loads `@stryker-mutator/jest-runner` explicitly (pnpm isolation). After changing tests, run with `--force`: incremental mode can reuse stale results when a test change is not a new/edited `it` (e.g. an `afterEach`). Accepted survivors: error-message text, and `.some(...)` -> `.every(...)` on a required to-one relation (equivalent: exactly one related row). Suites with update/delete keep a decoy row created first and assert it unchanged in `afterEach`.
- Tests: `pnpm run test:integration` (`*.int-spec.ts`, real Postgres `ttc_test` from `.env.test`, migrated by `test/integration-setup.js`, which refuses any other database). Test kit in `src/prisma8/testing/`: `useTestDb()` (one Prisma 7 + one Prisma 8 client per file, tables emptied before each test), `seed*` helpers (written through Prisma 8), `seedTaskAccess` (owner / assignee / stranger), typed matchers (`anyNumber`, `anyDate`... — `expect.any` is `any` and fails lint). Each repository suite is a `describe.each` over implementations: phase C adds the Prisma 8 one next to `prisma7` and the same tests must pass. The runtime is ESM-only: `test/esm-transformer.js` compiles only ESM files from `node_modules` for Jest; the app itself loads it through Node's `require(esm)` (Node 22.12+).

### Rates system

Three rate models serve different scopes:

- `TranslationRate` — user's personal rate catalog (optionally scoped to a client)
- `ClientRate` — per-client override rates
- `RateSheet` — structured rate sheets with CAT-tool match rates stored as JSON

### Project pricing model

`Project.unitPrice` (`Decimal(14,8)`) is **deprecated** for translation activity — no write path exists anywhere in the app (frontend or resolver logic beyond the raw DTO field), so any value on it is stale/legacy data. Current model: `fixedFee` / `hourlyRate` / `perWordRate` (each `Decimal(10,4)?` on `Project`), set independently, project can have any subset. Don't add new features against `unitPrice`; don't remove the column yet (still schema-present for old rows) but treat it as dead going forward.

### Invoice status machine

Valid transitions only: `DRAFT→SENT|CANCELLED`, `SENT→PAID|OVERDUE`, `OVERDUE→PAID`. Side effects: `SENT` sets `issuedAt`, `PAID` sets `paidAt`.

### Throttling

Global: 100 req/60s per IP (Redis-backed). Auth mutations (login, register, password reset): 5 req/60s. `GqlThrottlerGuard` bridges NestJS throttler to GraphQL execution context.

## Environment

Required at startup (app aborts if missing): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `APP_ENCRYPTION_KEY`.

Optional: `GOOGLE_CLIENT_ID/SECRET`, `HUBSPOT_*`, `SMTP_*`, `SENTRY_DSN`, `GRAPHQL_MAX_DEPTH` (default 10).
