# Backend architecture: GraphQL + REST

Status: descriptive, reflects codebase as of 2026-08-12. Not aspirational.

## 1. Why two API styles exist

The backend is NestJS 11 + Fastify. It exposes both a GraphQL endpoint (`POST /graphql`, code-first via `@nestjs/graphql`) and a set of REST controllers (`@nestjs/swagger`-documented, served under `/api`). This isn't accidental duplication — each protocol is used where its shape fits the problem.

### Why GraphQL

The core domain is a graph: `User → Client → Project → Task → TimeEntry`, with `Invoice`/`InvoiceItem`, `RateSheet`/`TranslationRate`/`ClientRate`, `Tag`, `Subtask`/`TaskComment`/`TaskLabel`/`TaskAttachment` hanging off it. Frontend screens need different slices and depths of that graph per view (a task list needs `subtasks` counts, a task detail needs comments+attachments+activities, a dashboard needs aggregates across clients/projects/invoices). GraphQL lets each query request exactly the fields/relations it needs in one round trip, instead of either over-fetching a fixed REST shape or hand-rolling a REST endpoint per view combination. Field-level resolvers (`@ResolveField`) compute derived data (e.g. `Project.totalTimeSeconds`, `Client.statusHistory`) lazily, only when requested.

### Why REST

REST is used everywhere GraphQL's single `POST /graphql` endpoint is a bad fit:

- **Cookie-based auth handshakes** — OAuth `/auth` → redirect → `/auth/callback` needs real HTTP redirects, not a POST body.
- **Third-party webhooks** — HubSpot calls back into the app and is verified by HMAC signature header, not a JWT cookie; this can't go through the authenticated GraphQL context.
- **Third-party API proxying** — Clockify and HubSpot controllers largely forward to those services' own REST APIs on the user's behalf (stored, encrypted credentials). This isn't querying TTC's own graph, so GraphQL's field-selection value doesn't apply.
- **Binary responses** — invoice PDF download returns a `Buffer` with `Content-Disposition`; GraphQL responses are JSON.
- **File uploads** — task attachment upload is multipart form data.
- **Server-Sent Events (SSE)** — timer state and auth/session events are long-lived push streams (`text/event-stream`), which don't map onto GraphQL query/mutation semantics (subscriptions were deliberately not adopted here — see §4).

### The trade-off this creates

`@nestjs/swagger` can't introspect GraphQL resolvers (they're all behind one `POST /graphql` route), so `src/main.ts` manually stubs a `/graphql` entry in the Swagger doc pointing readers at `src/schema.gql` + Apollo Sandbox, so `/api` doesn't silently look like it's missing the core domain API. `src/schema.gql` is auto-generated from the TypeScript resolver/entity code — never hand-edited.

## 2. Where each is used

| Concern                                                                                           | Protocol   | Why                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Domain CRUD & reads (clients, projects, tasks, time entries, invoices, rates, tags, users, admin) | GraphQL    | Client-driven field/relation selection over a real object graph                                                                      |
| Dashboard aggregates                                                                              | GraphQL    | Single query composing data from multiple domains                                                                                    |
| Auth session lifecycle (login, register, 2FA, password reset, token refresh)                      | GraphQL    | Mutations returning typed responses (`LoginResponse`, etc.), no redirect/cookie-_setting_ concern beyond what `@Context()` can touch |
| OAuth login/connect flows (Google login, Google Calendar, HubSpot)                                | REST       | Needs real 302 redirects and provider callback URLs                                                                                  |
| Third-party API pass-through (Clockify, HubSpot contacts/companies/deals)                         | REST       | Proxies another REST API 1:1; not TTC's own graph                                                                                    |
| Inbound webhooks (HubSpot)                                                                        | REST       | HMAC-verified, not JWT/cookie-authenticated                                                                                          |
| Invoice PDF                                                                                       | REST       | Binary stream response                                                                                                               |
| Task attachment upload                                                                            | REST       | Multipart file upload                                                                                                                |
| Timer state / auth events                                                                         | REST (SSE) | Long-lived push stream                                                                                                               |
| Audit log read                                                                                    | REST       | Historical placement; see §4 — this one is a soft exception, see challenge section                                                   |
| Health check                                                                                      | REST       | Infra liveness probe convention                                                                                                      |

## 3. Accessible routes

### 3.1 REST routes

**Health** (`app.controller.ts`)

- `GET /` — liveness check
- `GET /debug-sentry` — excluded from docs, marked for removal, throws test error for Sentry verification

**Auth** (`auth.controller.ts`, `auth-events.controller.ts`)

- `GET /auth/google` — start Google OAuth login
- `GET /auth/google/callback` — Google OAuth redirect target (excluded from Swagger, provider-invoked)
- `GET /auth/events` — SSE stream of session events (login/logout/token-refresh)

**Admin / Audit** (`audit.controller.ts`)

- `GET /admin/audit` — cursor-paginated audit log (ADMIN only; query params `userId`, `limit`, `cursor`)

**Invoices** (`invoices.controller.ts`)

- `GET /invoices/:id/pdf` — download invoice as PDF (owner only)

**Task attachments** (`attachments.controller.ts`)

- `POST /tasks/:taskId/attachments/file` — upload file attachment
- `POST /tasks/:taskId/attachments/url` — attach a URL/link
- `PATCH /tasks/:taskId/attachments/:id` — update URL attachment
- `DELETE /tasks/:taskId/attachments/:id` — delete attachment

**Timer events** (`timer-events.controller.ts`)

- `GET /timer/events` — SSE stream of live timer state
- `GET /timer/stats` — active SSE channel stats (admin only)

**Google Calendar** (`google-calendar.controller.ts`)

- `GET /google-calendar/auth` — start Google Calendar OAuth connect
- `GET /google-calendar/auth/callback` — provider callback (excluded from Swagger)
- `GET /google-calendar/status` — connection status
- `DELETE /google-calendar/disconnect` — revoke stored token
- `GET /google-calendar/events` — list events in a time range
- `POST /google-calendar/events` — create event on primary calendar

**Clockify** (`clockify.controller.ts`, all JWT-guarded)

- `GET /clockify/status` — connection status
- `POST /clockify/credentials` — set API key (encrypted at rest)
- `DELETE /clockify/credentials` — clear stored credentials
- `PATCH /clockify/workspace` — select active workspace
- `GET /clockify/workspaces` — list workspaces
- `GET /clockify/workspaces/:workspaceId/projects` — list projects
- `GET /clockify/workspaces/:workspaceId/entries/active` — currently running entry
- `GET /clockify/workspaces/:workspaceId/entries` — list entries in date range
- `POST /clockify/workspaces/:workspaceId/entries/import` — import into TTC time entries (dedup)
- `POST /clockify/workspaces/:workspaceId/entries` — start running entry
- `PATCH /clockify/workspaces/:workspaceId/entries/stop` — stop running entry
- `PATCH /clockify/workspaces/:workspaceId/entries/:entryId` — update entry
- `DELETE /clockify/workspaces/:workspaceId/entries/:entryId` — delete entry
- `GET /clockify/workspaces/:workspaceId/tags` — list tags
- `POST /clockify/workspaces/:workspaceId/tags` — create tag

**HubSpot** (`hubspot.controller.ts`)

- `GET /hubspot/auth` — start OAuth
- `GET /hubspot/auth/callback` — provider callback (excluded from Swagger)
- `GET /hubspot/status` — connection status
- `DELETE /hubspot/disconnect` — revoke token
- `GET /hubspot/contacts` — list contacts (paginated)
- `POST /hubspot/contacts/search` — search contacts by filter groups
- `GET /hubspot/contacts/:id` — get contact
- `POST /hubspot/contacts` — create contact
- `PATCH /hubspot/contacts/:id` — update contact
- `POST /hubspot/contacts/:id/import-client` — import HubSpot contact as TTC client
- `GET /hubspot/companies` — list companies (paginated)
- `POST /hubspot/companies/search` — search companies
- `POST /hubspot/companies` — create company
- `GET /hubspot/companies/:id` — get company
- `PATCH /hubspot/companies/:id` — update company
- `GET /hubspot/deals` — list deals (paginated)
- `POST /hubspot/deals/search` — search deals
- `GET /hubspot/deals/:id` — get deal
- `POST /hubspot/deals` — create deal
- `PATCH /hubspot/deals/:id` — update deal
- `POST /hubspot/associations` — associate records (e.g. contact↔company)
- `GET /hubspot/admin/connections` — list all users' HubSpot connections (ADMIN only)
- `DELETE /hubspot/admin/connections/:userId` — revoke a user's connection (ADMIN only)
- `POST /hubspot/webhooks/subscribe` — subscribe to HubSpot webhook events
- `POST /hubspot/webhooks` — inbound webhook receiver (excluded from Swagger, HMAC-verified)

### 3.2 GraphQL operations (single endpoint: `POST /graphql`)

**Auth** (`auth.resolver.ts`)

- Query: `me`, `backupCodeCount`
- Mutation: `updateMe`, `register`, `login`, `logout`, `refreshToken`, `setupTwoFactor`, `enableTwoFactor`, `disableTwoFactor`, `verifyTwoFactor`, `verifyTwoFactorBackup`, `regenerateBackupCodes`, `adminDisableTwoFactor`, `changePassword`, `deleteAccount`, `requestPasswordReset`, `resetPassword`

**Users** (`users.resolver.ts`)

- Query: `users`, `members`, `user`
- Mutation: `createUser`, `updateUser`, `removeUser`

**Clients** (`clients.resolver.ts`)

- Query: `clients`, `client`
- Mutation: `createClient`, `updateClient`, `deleteClient`, `createCompanyContact`, `updateCompanyContact`, `deleteCompanyContact`
- Field: `Client.statusHistory`

**Projects** (`projects.resolver.ts`)

- Query: `projects`, `project`
- Mutation: `createProject`, `updateProject`, `deleteProject`
- Field: `Project.totalTimeSeconds`

**Tasks** (`tasks.resolver.ts`)

- Query: `task`, `tasks` (by project), `myTasks`
- Mutation: `createTask`, `updateTask`, `deleteTask`, `createSubtask`, `updateSubtask`, `createChecklist`, `deleteChecklist`, `renameChecklist`, `deleteSubtask`, `createTaskComment`, `updateTaskComment`, `deleteTaskComment`, `createTaskLabel`, `deleteTaskLabel`
- Field: `Task.subtasks`, `Task.comments`, `Task.labels`, `Task.activities`, `Task.attachments`

**Time entries** (`time-entries.resolver.ts`, `task-time.resolver.ts`)

- Query: `timeEntries`, `activeTimer`
- Mutation: `createTimeEntry`, `startTimer`, `stopTimer`, `updateTimeEntry`, `resumeTimeEntry`, `deleteTimeEntry`
- Field: `TimeEntry.activities`, `Task.totalTimeSeconds`

**Activities** (`activities.resolver.ts`)

- Query: `myActivities`, `activity`
- Mutation: `createActivity`, `updateActivity`, `deleteActivity`, `createCharge`, `updateCharge`, `deleteCharge`

**Invoices** (`invoices.resolver.ts`)

- Query: `invoices`, `invoice`
- Mutation: `createInvoice`, `generateInvoice`, `updateInvoice`, `deleteInvoice`, `addInvoiceItem`, `updateInvoiceItem`, `removeInvoiceItem`

**Rates** (`translation-rates.resolver.ts`, `client-rates.resolver.ts`, `rate-sheets.resolver.ts`)

- Query: `translationRates`, `translationRate`, `clientRates`, `rateSheets`, `rateSheet`
- Mutation: `createTranslationRate`, `updateTranslationRate`, `deleteTranslationRate`, `createClientRate`, `updateClientRate`, `deleteClientRate`, `createRateSheet`, `updateRateSheet`, `deleteRateSheet`

**Tags** (`tags.resolver.ts`)

- Query: `tags`
- Mutation: `createTag`, `updateTag`, `deleteTag`

**Dashboard** (`dashboard.resolver.ts`)

- Query: `dashboard`

**Admin** (`admin.resolver.ts`)

- Query: `adminStats`, `adminClients`, `adminProjects`, `adminInvoices`, `adminTimeEntries`, `adminRates`
- Mutation: `adminCreateClient`, `adminUpdateClient`, `adminDeleteClient`, `adminCreateProject`, `adminUpdateProject`, `adminDeleteProject`, `adminUpdateInvoice`, `adminDeleteInvoice`, `adminDeleteTimeEntry`, `adminCreateRate`, `adminUpdateRate`, `adminDeleteRate`

## 4. Challenge: what should have been done differently

The split by protocol (graph reads/writes → GraphQL, everything else → REST) is the right call and shouldn't change. The criticism below is about execution details within that split, not the split itself.

**1. `GET /admin/audit` is REST for no REST-specific reason.** It's a plain cursor-paginated read of TTC's own data, admin-gated like `admin.resolver.ts`'s other admin queries — no binary payload, no webhook, no OAuth redirect. It should be `adminAuditLog` on `admin.resolver.ts` for consistency with every other admin read. As-is, an admin building an audit view has to mix a REST call into an otherwise all-GraphQL admin screen for no functional reason — this is a leftover of what was probably built before the GraphQL admin surface existed, never migrated.

**2. No GraphQL subscriptions, so two bespoke SSE controllers exist instead of one mechanism.** Timer state and auth/session events are both "push an event when server-side state changes" — a textbook `Subscription` use case in GraphQL (`graphql-ws` over WS, or `@Sap se/subscriptions` deprecated but replacements exist). Instead there are two independent SSE controllers (`timer-events.controller.ts`, `auth-events.controller.ts`), each maintaining its own Redis pub/sub wiring and its own reconnect/backpressure handling on the frontend. If a third real-time feature is ever added (e.g. live invoice status, live task assignment notifications), that becomes a third bespoke SSE channel instead of a third `Subscription` type sharing one transport. This was a reasonable call to make once (SSE is simpler to reason about than WS subscriptions, and the module comment says WS was tried and dropped) but the _second_ SSE controller should have prompted unifying on one real-time mechanism rather than copying the pattern.

**3. Clockify/HubSpot proxy controllers duplicate a lot of REST boilerplate that a thin BFF-style pattern would avoid.** Every workspace/contact/company/deal endpoint repeats the same shape: JWT guard → look up stored encrypted credentials → call third-party SDK → return JSON. None of this benefits from GraphQL (correctly reasoned above), but 40+ near-identical REST handlers across two controllers is a sign the _REST_ side itself wasn't kept DRY — a generic "proxy request to provider X with stored credentials" helper would have cut the controller code by half without touching the protocol choice.

**4. `unitPrice`-style dead schema and the manual `/graphql` Swagger stub are maintenance debt of the two-protocol choice, accepted knowingly.** The manual stub in `src/main.ts` has to be kept in sync by hand whenever a new top-level GraphQL module ships — nothing enforces that at compile time. A generated summary (walk `schema.gql` at build time, inject module names into the stub description) would remove the "someone forgot to update the stub" failure mode this design currently has no protection against.

**5. What would have been actively wrong: forcing everything into one protocol.** Worth stating explicitly since it's the obvious alternative — an all-REST backend would either sprawl into dozens of per-view endpoints (`/projects/:id/with-tasks-and-time`, `/dashboard/summary`, ...) or force the frontend into N+1 fetches; an all-GraphQL backend would need Apollo Server workarounds for OAuth redirects, HMAC webhooks, and file/PDF binary responses that don't belong in a query language built for typed JSON reads. The two-protocol split is the correct shape for this domain — the fixes above are about tightening execution, not undoing the decision.
