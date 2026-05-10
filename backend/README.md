# EzTech Backend

Express.js + TypeScript API for the EzTech rental delivery platform.

## Prerequisites

- Node.js `>=22.12.0` (use `nvm install 22 && nvm use 22`)
- npm
- Docker (for Postgres — `docker compose up -d`)

## Setup

```bash
cd eztech/backend
npm install
docker compose up -d        # starts Postgres on :5432; creates eztech_dev + eztech_test automatically
cp .env.example .env
# edit .env — set a 32+ char JWT_SECRET, update ADMIN_PASSWORD
npx prisma migrate dev
npx prisma db seed          # creates the first admin user
npm run dev
```

Server boots at `http://localhost:3001`. Sanity check:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","uptime":...,"timestamp":"..."}
```

## Admin bootstrap

The seed script creates one admin user from env vars. It is idempotent — safe to run multiple times.

```bash
docker compose up -d
npx prisma migrate dev
npx prisma db seed
# ADMIN_EMAIL and ADMIN_PASSWORD are read from .env (defaults: admin@eztech.fr / change-me)
```

Change `ADMIN_PASSWORD` in `.env` before seeding on any shared or production environment.

## Environment variables

See `.env.example` for the full list. All vars are validated by zod at startup; the process exits with a clear error if anything is missing or malformed.

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3001` | HTTP port |
| `DATABASE_URL` | — | Postgres connection string (required) |
| `JWT_SECRET` | — | Min 32 chars (required) |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime (regex: `\d+[smhdwy]`) |
| `JWT_REFRESH_TTL` | `30d` | Refresh token lifetime |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` |
| `ADMIN_EMAIL` | `admin@eztech.fr` | Email for the seeded admin user |
| `ADMIN_PASSWORD` | `change-me` | Password for the seeded admin user |

**Note:** The response field for the access token is `token`, not `accessToken` (ADR-011 — matches the frontend `useAuth` composable expectation).

## Auth routes

All routes are prefixed `/api/auth`.

| Method | Path | Auth required | Description | Success response |
|--------|------|---------------|-------------|-----------------|
| POST | `/api/auth/register` | No | Create customer account | `201 { user, token, refreshToken }` |
| POST | `/api/auth/login` | No | Authenticate user | `200 { user, token, refreshToken }` |
| POST | `/api/auth/refresh` | No (refresh token in body) | Rotate refresh token | `200 { token, refreshToken }` |
| POST | `/api/auth/logout` | No (refresh token in body) | Revoke refresh token | `204` |
| GET | `/api/auth/me` | Bearer token | Get current user | `200 { user }` |
| POST | `/api/auth/forgot-password` | No | Stub (Phase 6) | `200 { message }` |

`user` shape: `{ id, email, name, phone, role, createdAt, updatedAt }` — never includes `passwordHash`.

## User admin routes

| Method | Path | Auth required | Description | Success response |
|--------|------|---------------|-------------|-----------------|
| GET | `/api/users/:id` | Bearer (admin only) | Get user by id | `200 { user }` |
| PATCH | `/api/users/:id` | Bearer (admin only) | Update name, phone, or role | `200 { user }` |

## Running tests

```bash
docker compose up -d    # Postgres must be running (single container, two databases)
npm test
```

The test runner uses `eztech_test` database. Dev data in `eztech_dev` is never touched.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Hot-reload dev server (tsx) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm test` | Vitest run |
| `npm run test:watch` | Vitest watch |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run migrations in dev |
| `npm run prisma:seed` | Seed admin user |

## Project layout

```
src/
├── index.ts           # entry — starts http server
├── app.ts             # builds and exports the Express app
├── config/env.ts      # zod-validated env loader
├── lib/
│   ├── logger.ts      # pino instance
│   ├── password.ts    # bcrypt hash/verify helpers + DUMMY_HASH
│   ├── prisma.ts      # PrismaClient singleton
│   └── refresh-token.ts  # refresh token generate/rotate/revoke helpers
├── middleware/
│   ├── auth.ts        # JWT sign/verify + requireAuth + requireRole
│   ├── error.ts       # central error handler + HttpError
│   └── notFound.ts    # 404 catcher
├── routes/
│   ├── index.ts       # mounts all routers under /api
│   ├── health.ts      # GET /api/health
│   ├── auth.ts        # POST /api/auth/* routes
│   └── users.ts       # GET/PATCH /api/users/:id (admin)
├── schemas/
│   ├── auth.ts        # zod schemas: Register, Login, Refresh, Logout
│   └── user.ts        # zod schemas: PatchUser
└── types/express.d.ts # augments Request with `user`
prisma/
├── schema.prisma      # User, RefreshToken models + Role enum
├── migrations/        # Prisma migration history
└── seed.ts            # admin user seed script
docker/
└── init-db.sql        # creates eztech_test on first container start
tests/
├── auth.test.ts       # integration tests for /api/auth/*
├── users.test.ts      # integration tests for /api/users/*
├── health.test.ts     # smoke test for /api/health
├── globalSetup.ts     # runs migrate deploy + seed before suite
├── helpers/db.ts      # truncateAuthTables helper
└── setup.ts           # loads .env.test before test modules
```
