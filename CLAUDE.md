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

Optional `.env` key: `CLOCKIFY_API_URL` (defaults to `https://api.clockify.me/api/v1`).

## Architecture

**Stack**: NestJS 11 + Fastify, GraphQL (code-first, Apollo driver), Prisma 7 + `@prisma/adapter-pg`, Passport.js, Sentry, Swagger at `/api`.

**Module layout** — each domain module (`users`, `projects`, `auth`, `clockify`) follows this layering:

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
├── auth.resolver.ts          — GraphQL: me, login, register, logout, refreshToken, setupTwoFactor, enableTwoFactor, verifyTwoFactor
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
└── dto/ + types/
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
                 clockifyApiKey?, clockifyUserId?, clockifyWorkspaceId?, timestamps
RefreshToken   — tokenHash (SHA-256), userId, expiresAt
OAuthAccount   — provider, providerId, userId  (unique on [provider, providerId])
Project        — id, title, description, userId?
```

## Clockify Module (`src/clockify/`)

Pure REST module — no GraphQL. All endpoints at `/clockify/*`, guarded by `AuthGuard('jwt')`.

```
src/clockify/
├── clockify.module.ts
├── clockify.controller.ts   — REST endpoints (see table below)
├── clockify.service.ts      — wraps Clockify REST API via native fetch; reads API key from user record
├── dto/
│   ├── set-credentials.dto.ts    — { apiKey: string; workspaceId?: string }
│   └── start-time-entry.dto.ts   — { description?, projectId?, tagIds?, start?, billable? }
└── types/
    ├── clockify-workspace.type.ts
    ├── clockify-project.type.ts
    └── time-entry.type.ts
```

**Endpoints:**

| Method   | Path                                         | Purpose                                                                |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/clockify/status`                           | `{ connected: boolean; workspaceId: string \| null }`                  |
| `POST`   | `/clockify/credentials`                      | Validate API key against Clockify, save key + `clockifyUserId` to user |
| `PATCH`  | `/clockify/workspace`                        | Update preferred workspace ID only (no re-validation)                  |
| `GET`    | `/clockify/workspaces`                       | List user's Clockify workspaces                                        |
| `GET`    | `/clockify/workspaces/:id/projects`          | List projects in workspace                                             |
| `GET`    | `/clockify/workspaces/:id/entries`           | List time entries (query: `start?`, `end?`)                            |
| `GET`    | `/clockify/workspaces/:id/entries/active`    | Running timer or `null`                                                |
| `POST`   | `/clockify/workspaces/:id/entries`           | Start new timer                                                        |
| `PATCH`  | `/clockify/workspaces/:id/entries/:eid/stop` | Stop running timer                                                     |
| `DELETE` | `/clockify/workspaces/:id/entries/:eid`      | Delete entry                                                           |

**Key rules:**

- `ClockifyService` uses native `fetch` (no `@nestjs/axios`) — Node 18+ has `fetch` globally; `@types/node@24` types it.
- API key stored per-user in `User.clockifyApiKey` (plain text). Never expose the raw key in any response.
- `clockifyUserId` (Clockify's UUID for the user) is fetched from `GET /user` during `setCredentials` and stored in `User.clockifyUserId` — required for time entry list endpoints.
- For REST controllers, use `@Req() req: FastifyRequest & { user: RequestUser }` — no `@CurrentUser()` decorator (that only works in GraphQL context).
- `UsersModule` exports `UsersService` so `ClockifyModule` can import it.

## Status & Known Gaps

- `users.resolver.ts` and `projects.resolver.ts` are **not yet guarded**. Add `@UseGuards(GqlAuthGuard)` to all queries/mutations that require authentication.
- `disableTwoFactor` service method exists in the repository contract but is not yet exposed as a GraphQL mutation or called from the frontend.
- `refreshToken` mutation exists but the frontend does not yet call it automatically on 401 — an Apollo error link needs to be wired up.
- Microsoft OAuth is not implemented (no `passport-microsoft` strategy or controller endpoints).
- Clockify API key stored in plaintext — consider encrypting at rest with an app-level secret.

## Docs

Implementation logs live in `../docs/implementations/`:

- `auth-implementation.md` — backend auth system (Passport strategies, JWT, cookies, schema)
- `auth-ui.md` — frontend auth pages and routing

Plans live in `../docs/plans/`:

- `clockify-integration.md` — Clockify REST integration design
