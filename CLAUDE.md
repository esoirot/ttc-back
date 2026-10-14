# CLAUDE.md — the-translator-companion (backend, repo `ttc-back`)

NestJS 11 + Fastify 5, GraphQL code-first (Apollo), Prisma 8 (`@prisma/orm-postgres`) + PostgreSQL, Redis (throttler + pub/sub), JWT in HTTP-only cookies, TypeScript 7. Frontend: `../ttc-front` (its own `CLAUDE.md`). Workspace map: `../CLAUDE.md`.

## Working rules

- Never start or stop the dev server (`pnpm run start:dev`); the operator runs it. Don't verify against it unless asked — use tests.
- **Swagger is mandatory on every REST change** (see **REST + Swagger**): a change to a `*.controller.ts` or its DTOs is incomplete without it.
- Always **pnpm**.

## Workflow and done checklist

Test-first, red → green → refactor; bug fixes start with a failing test that reproduces them. BDD-style titles ("delegates to the service with the user id"), given/when/then in complex specs. Done when:

1. Failing spec written first (unit `*.spec.ts` for services/resolvers, `*.int-spec.ts` for repositories, `test/*.e2e-spec.ts` for endpoints), then passing.
2. REST change → Swagger decorators updated. GraphQL change → `src/schema.gql` regenerated (operator restarts the server) and committed — the frontend mirrors it.
3. Schema change → Prisma 8 migration generated and committed (see **Prisma 8**).
4. Targeted tests pass (`pnpm run test <path>`, `pnpm run test:integration <path>`).
5. `pnpm run check` passes (`scripts/check.mjs`): typecheck, circular, knip (unused files, exports and dependencies — `knip.json`), format, lint (no fix — fails), audit (known findings ignored in `pnpm-workspace.yaml`, see README), unit, integration, e2e, build, then mutation on lines changed since `origin/main` in folders with an `*.int-spec.ts` (`scripts/mutate-changed.mjs`), which ends by listing the surviving mutants on those lines only. `integration` and `mutation` need `ttc_test`. Use `pnpm run test:mutation --mutate <files> --force` by hand after test-only changes. Skip steps with `--skip a,b` (`--list` for names) — say which steps you skipped and why.

## Commands

```bash
pnpm run test [path]               # unit (Jest, src/**/*.spec.ts)
pnpm run test:integration [path]   # repositories against real Postgres `ttc_test` (*.int-spec.ts, one worker)
pnpm run test:e2e                  # test/*.e2e-spec.ts (config test/jest-e2e.json)
pnpm run test:mutation:changed     # Stryker on changed integration-tested lines (part of check)
pnpm run test:mutation --mutate <files> [--force]   # by hand; integration suite, incremental, concurrency 1
pnpm run check [--skip a,b] [--list]    # full gate (see checklist)
pnpm run typecheck | lint | format | format:check | circular | knip
docker compose up -d               # postgres + redis (operator)
pnpm prisma contract emit          # after editing prisma8/contract.prisma
pnpm prisma migration plan --name <n> --from <latest migrations/app dir>   # ALWAYS --from
pnpm run prisma:miggen             # deploy: migrate-guard, then prisma db migrate
```

- Runtime: TypeScript 7 has no JS compiler API, so nothing runs through `ts-node` or the Nest CLI. `start*` = `node -r ./swc-register.cjs` (SWC with decorator metadata — tsx/esbuild would break DI), `build` = `tsc -p tsconfig.build.json`, Jest uses `@swc/jest`. ESLint lives in `.lint-tools/` with its own `node_modules` (use `pnpm run lint`).
- Scripts: `src/scripts/` (`db:dump`, `db:export`, `db:import`, `import:tholemac`).

## Where things live

| What                      | Path                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature module            | `src/<domain>/` — `*.module.ts`, `*.resolver.ts`, `*.service.ts`, `*.controller.ts` (REST), `entities/`, `dto/`, `repositories/`, `types/`                        |
| Repository port / adapter | `repositories/<name>.repository.ts` (abstract) / `repositories/prisma8-<name>.repository.ts`, bound with `{ provide: XRepository, useClass: Prisma8XRepository }` |
| Prisma 8 helpers          | `src/prisma8/` — `Prisma8Service`, `ownership.ts`, `access.ts`, `timestamp.ts`, `numeric.ts`, `like.ts`, `count.ts`, `testing/`                                   |
| Schema / migrations       | `prisma8/contract.prisma`, `generated/prisma8/`, `migrations/app/` (Prisma 7 history: `prisma/migrations/`, read-only)                                            |
| GraphQL loaders           | `src/common/graphql/` — `loaders.service.ts`, `batch-loader.util.ts`                                                                                              |
| Shared infra              | `src/common/` — `realtime/` (SSE), `oauth-token/`, `crypto.util.ts`, `guards/`, `cleanup/`, `db-backup/`                                                          |
| Unit mock factories       | `src/__test-helpers__/mock-factories.ts`                                                                                                                          |
| Generated GraphQL schema  | `src/schema.gql` (never edit; regenerated on server start)                                                                                                        |
| Architecture notes        | `docs/final-arch.txt`, `docs/arch-todo.txt`, `docs/architecture/backend-architecture.md`                                                                          |

## Principles

- **Hexagonal** — services depend on repository abstractions, never on Prisma/HTTP/Redis directly; new external deps get a port + adapter.
- **DDD** — `src/<domain>/` mirrors the domain; entities carry rules; cross-module access goes through the other module's service, never its repository.
- **SOLID** — one reason to change per class; extend with new providers/strategies; substitutable behind abstractions; slim interfaces; inject concretes via `useClass`.
- **ACID** — multi-step writes that must agree (entity + history/audit…) run in one `db.transaction(async (tx) => …)`.
- **KISS / DRY** — simplest thing; extract on the second duplication.

## Prisma 8 (data access)

- One client app-wide: inject `Prisma8Service` (global `Prisma8Module`; modules don't list it) and query `this.db.orm.public.<Model>`. Prisma 7 is gone.
- **Ownership**: ids taken from input (`clientId`, `taskId`, `tagIds`…) must belong to the caller — call `assertOwned` / `assertTasksVisible` / `assertSubtasksVisible` (`src/prisma8/ownership.ts`) in the repository write before storing them. Unknown and foreign ids both throw NotFound.
- **Timestamps** are `TimestampString(3)` in the contract: convert at the repository boundary with `fromDb`/`toDb` (`src/prisma8/timestamp.ts`); the app uses `Date`. No automatic `updatedAt` — set it on every update.
- **Decimals** come back as strings: `Number(...)` on read, `toNumeric(...)` (`src/prisma8/numeric.ts`) on write.
- **Search**: `.ilike(containsPattern(text))` (`src/prisma8/like.ts` escapes `%`/`_`).
- **Danger**: a single-row `where(...).update()`/`.delete()` with a missing or empty filter hits one arbitrary row (lowest id). In tests never make the target the first row, so a dropped filter fails.
- Relation field names in `contract.prisma` keep the Prisma 7 names (`contacts`, `items`, `tags`…); GraphQL types and mappers rely on them.
- GraphQL enums are TS enums declared next to their `registerEnumType` in the entity file.
- **Schema change**: edit `prisma8/contract.prisma` → `pnpm prisma contract emit` → `pnpm prisma migration plan --name <n> --from <latest migrations/app dir>` (without `--from` it starts from the baseline and re-applies old migrations; check the new `migration.json` `from` equals the previous `to`) → commit `generated/prisma8/` and `migrations/`. Both are generated: excluded from tsconfig and Prettier. Never `prisma db init`/`db update` on a real database.
- **Removing an enum value**: `migration plan` refuses it — `prisma migration new --name <n> --from <previous to-hash>`, write the ops in `migration.ts` with `rawSql({...})` (move rows, rename type, create new, convert column `USING col::text::"Type"`, restore default, drop old), then `node migrations/app/<dir>/migration.ts` to emit `ops.json`. Example: `20261009T1003_prospect_cycle_v2`.
- **Deploy guard**: `prisma:miggen` runs `src/scripts/migrate-guard.ts` first — an unsigned database with tables (a Prisma 7 database that skipped `prisma db sign`) stops with instructions instead of running the baseline.
- Pin `@prisma/orm-postgres` to the `@prisma/orm-toolchain` version the `prisma` CLI depends on (`pnpm view prisma@<v> dependencies`); a mismatch crashes `contract infer`/`emit` with "Malformed authoring pslBlock contribution".

## GraphQL

- `src/schema.gql` is generated (`autoSchemaFile`) and committed — never edit it; edit entities/resolvers, then it regenerates on server start.
- Orphaned union members (`TranslatorOccupation`, `CorrectorOccupation`, `CustomOccupation`) are listed in `AppModule` `buildSchemaOptions.orphanedTypes` (code-first drops types unreachable from root resolvers).
- Depth limit: `graphql-depth-limit` in `GraphQLModule.forRootAsync` (`app.module.ts`), `GRAPHQL_MAX_DEPTH` (default 10).
- **Field resolvers re-check ownership** — never trust the parent query. Relations without their own `userId` (`Subtask`, `TaskComment`, `TaskLabel`, `TaskAttachment`, `TaskActivity`) scope through the parent task's project owner (`taskVisibleTo`, `src/prisma8/access.ts`; tasks have no assignee since 2026-10-08); relations with a direct owner (`ClientStatusHistory` via `client.userId`, time-entry `TaskActivity` via `timeEntry.userId`) scope through it. Aggregates (`Project.totalTimeSeconds`, `Task.totalTimeSeconds`) sum **all** contributors — `userId` gates access to the parent, never which rows are summed.
- **Field resolvers go through DataLoaders** (`@Context() ctx: GqlContext`, `ctx.loaders.<name>.load(id)`), never a service per row (N+1). New one: add a scoped batch method `findByXIds(ids, userId)` to the repository, a loader in `LoadersService.createLoaders()` with `createGroupedListLoader`/`createMappedValueLoader`, then `ctx.loaders.<name>.load(id)` in the resolver.
- **Naming**: `Occupation` (`src/occupations/`) is the user's business line (renamed from `Activity`); `TaskActivity` (`src/tasks/activities.service.ts`, the `activities` field) is the unrelated task history log.

## REST + Swagger

Swagger UI at `/api` (`DocumentBuilder` in `src/main.ts`). It is the only REST documentation. GraphQL is a single generic `/graphql` stub pointing at `schema.gql` and the Sandbox — don't expand it or list modules in it.

No `@nestjs/swagger` CLI plugin (no Nest CLI), so nothing is inferred: a DTO field without `@ApiProperty` is missing from `/api`. Every REST change adds/updates:

- **Controller**: `@ApiTags('<feature>')`; `@ApiCookieAuth('access_token')` on the class (all routes authed) or per method — cookie auth, never `@ApiBearerAuth`.
- **Endpoint**: `@ApiOperation({ summary })` (one line, incl. access restriction like "ADMIN only"); `@ApiParam`/`@ApiQuery` per param; `@ApiConsumes`/`@ApiBody` with a schema for uploads or inline bodies; `@ApiExcludeEndpoint()` + one-line reason for OAuth callbacks, HMAC-verified webhooks, debug routes.
- **DTO field**: `@ApiProperty({ description, example })` (`required: false` when optional, `nullable: true` for `X | null`, `enum: [...]` for string unions). Inline object types become their own exported class with `@ApiProperty`s (plain TS types produce no schema).

## Auth, realtime, security

- JWT access token (15 min, `JWT_EXPIRES_IN`) + refresh token in HTTP-only cookies. Passport: `local`, `jwt`, `google-oauth20`. Guards: `GqlAuthGuard` (resolvers), `JwtAuthGuard` (REST), `RolesGuard` + `@Roles()`. 2FA: TOTP + backup codes, both hashed. `AuthRepository` → `Prisma8AuthRepository`.
- **SSE, not subscriptions**: `TimerEventsService` and `AuthEventsService` use `src/common/realtime/` — `createRedisClientPair()` (one pair per service), `RealtimeChannelRegistry<T>` (`gated: true` for the timer's staged lifecycle, `false` for auth's immediate delivery — keep the two modes distinct), `writeSseStream()` (`sse-stream.util.ts`). Redis pub/sub keeps instances in sync.
- **Encryption**: Clockify API key and HubSpot/Google OAuth tokens encrypted with `APP_ENCRYPTION_KEY` (64 hex chars) via `src/common/crypto.util.ts`. OAuth refresh (expiry, coalescing concurrent refreshes, token exchange) shared in `OAuthTokenRefreshService` (`src/common/oauth-token/`); provider-specific success/failure stays in callbacks (Google clears credentials on `invalid_grant` and keeps the old refresh token if none is reissued; HubSpot overwrites both).
- **Throttling**: global 100 req/60 s per IP (Redis); sensitive operations (login, register, password changes, admin writes…) override it per method with `@Throttle` (mostly 5–10/60 s) — read the decorator. `GqlThrottlerGuard` bridges the throttler to GraphQL.
- **Audit log**: fire-and-forget `AuditLog` writes (HubSpot, Clockify, Clients, Projects, Invoices) — never `await` them. Retention job in `CleanupModule` (`AUDIT_RETENTION_DAYS`, default 90). `GET /admin/audit` is unused legacy — leave it.

## Domain rules

- **Clients** `clients(search, companyName, firstName, lastName, clientType, status, excludeStatus, industry, sort)` → one `ClientFilters` object. `search` matches company `name` or a person's first/last name; the three name filters each target their column. `sort: { field: NAME | LAST_NAME | FIRST_NAME, direction }` orders by that name, then the other, then oldest; `Intl.Collator` (case/accents ignored), empty names last; individuals default to LAST_NAME ASC, unsorted lists oldest first. Sorted lists page in memory from the cursor (`sortedPage`). Clients page asks `status: CLIENT`, the prospect board `excludeStatus: CLIENT` (so `FORMER_CLIENT` only shows there). `linkedinUrl`/`website` stored as given (frontend validates).
- **Prospect cycle** (`src/clients/prospect-due.util.ts`): TO_CONTACT → CONTACTED → FOLLOW_UP_1 → FOLLOW_UP_2 → RECONTACT_LATER (no FOLLOW_UP_3). Waits count from the newer of `contactedAt`/`toRecontactAt` (`newestContactDate`). `prospectDueAt`: null (due now) for TO_CONTACT, FORMER_CLIENT or no date; +14 days for CONTACTED/FOLLOW_UP_1/FOLLOW_UP_2; +182 for RECONTACT_LATER; never for TALKING/CLIENT. Dashboard lists prospects due now or within 30 days (due-now first, then earliest, ties by id). `ProspectCronService` (05:00) moves FOLLOW_UP_2 → RECONTACT_LATER after 21 days. `ClientsService.update`: a newer (or first) `contactedAt` steps the status (`nextStatusAfterContact`: TO_CONTACT/FORMER_CLIENT/RECONTACT_LATER → CONTACTED, FOLLOW_UP_2 → RECONTACT_LATER, TALKING/CLIENT stay) unless the same input sets another status.
- **Words**: time-entry `wordsProcessed` is stored, never counted. Task words = own `wordCount` + checklist items with `Subtask.countInTotal` (default true); `Project.totalTaskWords` sums per project (`SubtasksService.getTotalWordsByProjectIds`). Dashboard `yearToDateWords` = those totals for DONE/PAID tasks due this year. `Project.wordCount` is the hand-entered target used by `generateInvoice`.
- **Dashboard deadlines**: open projects (`deadline`), tasks (`dueDate`, not DONE/PAID) and unticked checklist items, overdue or due within 30 days, earliest first, max 20; rows carry `kind` (PROJECT/TASK/CHECKLIST_ITEM) and project/task ids and titles.
- **Kanban**: `moveTask(id, status, position)` is the only write that moves a card; it renumbers the target column 0..n (and the source on a status change) in one transaction. `updateTask.sortOrder` is for the flat list only. `Task.color`: nullable hex, empty string clears.
- **Project history**: `projectActivities(projectId, pagination)` pages task activity newest first (keyset on createdAt + id, with `task { id title }`).
- **Invoices**: amounts (`numeric(10,4)`) only through `lineAmounts()`/`hoursOf()` (`src/invoices/line-amounts.ts`) — exact 1/10000 integer maths, half away from zero, never `quantity * unitPrice` in floats. `generateInvoice` refuses a project with nothing to bill ("Nothing to invoice"). Status machine: `DRAFT→SENT|CANCELLED`, `SENT→PAID|OVERDUE`, `OVERDUE→PAID`; SENT sets `issuedAt`, PAID sets `paidAt`.
- **Pricing**: `Project.unitPrice` is deprecated (no write path; keep the column) — use `fixedFee`/`hourlyRate`/`perWordRate` (each optional).
- **Rates**: `TranslationRate` (user catalog, optionally per client), `ClientRate` (per-client override), `RateSheet` (CAT match rates as JSON).

## Testing

- **Unit** (`*.spec.ts`): mock repositories; factories in `src/__test-helpers__/mock-factories.ts`.
- **Integration** (`*.int-spec.ts`, `pnpm run test:integration`): real Postgres `ttc_test` from `.env.test`, migrated by `test/integration-setup.js` (refuses any other database). Kit in `src/prisma8/testing/`: `useTestDb()` (one client per file, tables emptied before each test), `seed*` helpers + `at(minute)`, `seedTaskAccess` (owner/stranger), typed matchers (`anyNumber`, `anyString`, `anyDate`, `isoTimestamp` — `expect.any` is `any` and fails lint). Repository suites keep a single-entry `describe.each` over implementations. Suites with update/delete create a decoy row first and assert it unchanged in `afterEach`.
- ESM-only deps: `test/esm-transformer.js` compiles ESM files from `node_modules` for Jest; the app loads them via Node's `require(esm)` (Node ≥ 22.12).
- **Mutation** (`stryker.config.json`): runs the integration config, one at a time (shared DB). `tsconfigFile` points at a missing file on purpose (TS 7) and `@stryker-mutator/jest-runner` is loaded explicitly. Use `--force` after test changes that aren't new/edited `it`s (e.g. an `afterEach`) — incremental mode may reuse stale results. Accepted survivors: error-message text; `.some → .every` on a required to-one relation.

## Environment

Required (startup aborts): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `APP_ENCRYPTION_KEY`. Optional: `GOOGLE_CLIENT_ID/SECRET`, `HUBSPOT_*`, `SMTP_*`, `SENTRY_DSN`, `GRAPHQL_MAX_DEPTH` (10), `AUDIT_RETENTION_DAYS` (90), `JWT_EXPIRES_IN` (15m), `GRAPHQL_SANDBOX` (true), `REDIS_URL` (`redis://localhost:6379`). Attachments: `STORAGE_DRIVER` = `local` (default) | `s3` | `azure`; `s3` requires `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`. All validated by the Joi schema in `src/app.module.ts` — add new variables there.

History: Prisma 8 port plan `../docs/plans/step1.25/prisma8-port.md`.
