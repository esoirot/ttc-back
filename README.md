# The Translator Companion

NestJS + Fastify backend with a GraphQL API, Prisma ORM, and HubSpot integration.

## Stack

- **NestJS 11** on **Fastify**
- **GraphQL** (code-first via `@nestjs/graphql`)
- **Prisma 7** + PostgreSQL (`@prisma/adapter-pg`)
- **Swagger** — `http://localhost:3000/api` / `http://localhost:3000/api-json`
- **Sentry** (tracing + profiling)
- **HubSpot** API client

## Prerequisites

- Node.js, pnpm
- Docker (for the local database)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment** — create a `.env` file at the root:

   ```env
   DATABASE_URL=postgresql://ttc-postgres-user:ttc-postgres-user@localhost:51214/ttc-postgres-db
   SENTRY_DSN=your_sentry_dsn
   ```

3. **Start the database**

   ```bash
   docker compose up -d
   ```

4. **Run migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

## Running the app

```bash
pnpm run start:dev    # watch mode (recommended for development)
pnpm run start        # single run
pnpm run start:prod   # production (requires prior build)
```

## Database

```bash
npx prisma migrate dev --name <migration-name>   # apply schema changes & regenerate client
npx prisma db pull --print                       # introspect DB into schema (print only)
npx prisma generate                              # regenerate client without migrating
```

The Prisma client is generated to `src/generated/prisma/` (not `node_modules`).

## Tests

```bash
pnpm run test           # unit tests
pnpm run test:watch     # watch mode
pnpm run test:cov       # with coverage
pnpm run test:e2e       # end-to-end tests
```
