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

Rider sign-up: pass `vehicleType` (`bicycle`/`scooter`/`car`) plus `licenseNumber` and `insuranceNumber` to `/api/auth/register` and the account is created with `role=rider` and `riderApplicationStatus=pending`.

## User admin routes

| Method | Path | Auth required | Description | Success response |
|--------|------|---------------|-------------|-----------------|
| GET | `/api/users` | Bearer (admin only) | List users; `?role=` and `?applicationStatus=` filters (rider onboarding queue) | `200 { users }` |
| GET | `/api/users/:id` | Bearer (admin only) | Get user by id | `200 { user }` |
| PATCH | `/api/users/:id` | Bearer (admin only) | Update name, phone, or role | `200 { user }` |
| PATCH | `/api/users/:id/rider-application` | Bearer (admin only) | Approve / reject a rider onboarding application (`{ status: 'approved' \| 'rejected' \| 'pending' }`) — rejected/pending forces the rider offline | `200 { user }` |

## Rider routes

All routes are `Bearer` + `role=rider`. Going online and accepting work require `riderApplicationStatus = 'approved'` (otherwise `403 application_not_approved`).

| Method | Path | Description | Success response |
|--------|------|-------------|-----------------|
| GET | `/api/rider/profile` | Rider profile + delivered-order count + application status | `200 { profile }` |
| PUT | `/api/rider/profile` | Update name / phone / vehicle / licence / insurance | `200 { profile }` |
| PATCH | `/api/rider/status` | Toggle online (`{ online: boolean }`) — requires an approved application | `200 { online }` |
| POST | `/api/rider/documents` | Upload licence/insurance proof — `{ type, fileName, mimeType, contentBase64 }` (≤ 5 MB) | `201 { document }` |
| GET | `/api/rider/documents` | List uploaded documents | `200 { documents }` |
| GET | `/api/rider/orders/available` | Unclaimed orders the rider has not declined (empty when offline) | `200 { orders }` |
| GET | `/api/rider/orders/active` | The rider's current in-progress delivery | `200 { order \| null }` |
| POST | `/api/rider/orders/:id/accept` | Atomically claim a pending order | `200 { order }` / `409` |
| POST | `/api/rider/orders/:id/decline` | Hide the order from this rider's list | `204` |
| GET | `/api/rider/returns` | Available (scheduled, unclaimed) returns + the rider's accepted/completed returns | `200 { available, mine }` |
| POST | `/api/rider/returns/:id/accept` | Atomically claim a scheduled return | `200 { return }` / `409` |
| PATCH | `/api/rider/returns/:id/complete` | Mark a return collected from the customer (credits the rider, sends a notification) | `200 { return }` |
| GET | `/api/rider/notifications` | Notifications, newest first; `?unread=true` filter | `200 { notifications, unreadCount }` |
| PATCH | `/api/rider/notifications/:id/read` | Mark one notification read | `204` / `404` |
| POST | `/api/rider/notifications/read-all` | Mark every unread notification read | `200 { updated }` |
| GET | `/api/rider/earnings` | Sums for today / week / month / all-time (deliveries + completed returns) | `200 { today, week, month, allTime }` |
| GET | `/api/rider/earnings/history` | Per-job breakdown (`kind: 'delivery' \| 'return'`), newest first | `200 { history }` |

## Order & return routes

| Method | Path | Auth required | Description | Success response |
|--------|------|---------------|-------------|-----------------|
| POST | `/api/orders` | Bearer (customer or admin) | Create a delivery job (lands in the rider pool, notifies online riders) | `201 { order }` |
| GET | `/api/orders/:id` | Bearer (owning customer, assigned rider, or admin) | Order detail + event timeline | `200 { order }` |
| PATCH | `/api/orders/:id/status` | Bearer (assigned rider) | Advance delivery: `at_warehouse` → `picked_up` → `in_transit` → `delivered` (credits the rider on `delivered`) | `200 { order }` |
| POST | `/api/returns` | Bearer (customer or admin) | Schedule a return pickup (notifies online riders) | `201 { return }` |
| GET | `/api/returns/:id` | Bearer (owning customer, assigned rider, or admin) | Return detail | `200 { return }` |

> `PATCH /api/orders/:id/status` writes an `OrderEvent` row for every transition — murx's Socket.io layer subscribes to these and broadcasts the update to the customer. Order/return creation and completion also create `Notification` rows for the relevant riders.

Uploaded rider documents are written under `backend/uploads/` and served read-only from `/uploads/...`.

## Demo data

`npm run seed:demo` creates an **approved** rider (`rider@eztech.fr` / `riderpass123`), three pending delivery jobs, one scheduled return pickup, and a couple of notifications so the rider dashboard has something to work with.

## Running tests

```bash
docker compose up -d    # Postgres must be running (single container, two databases)
cp .env.test.example .env.test   # first time only — edit JWT_SECRET and ADMIN_PASSWORD
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
| `npm run seed:demo` | Seed demo rider + pending orders |

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
│   ├── orders.ts      # order/return reference, assignment TTL, rider status transitions
│   ├── notifications.ts  # notify() + notifyOnlineRiders() helpers
│   └── refresh-token.ts  # refresh token generate/rotate/revoke helpers
├── middleware/
│   ├── auth.ts        # JWT sign/verify + requireAuth + requireRole
│   ├── error.ts       # central error handler + HttpError
│   └── notFound.ts    # 404 catcher
├── routes/
│   ├── index.ts       # mounts all routers under /api
│   ├── health.ts      # GET /api/health
│   ├── auth.ts        # POST /api/auth/* routes
│   ├── users.ts       # /api/users (admin) + /api/users/:id/rider-application
│   ├── rider.ts       # /api/rider/* (profile, documents, status, orders, returns, notifications, earnings)
│   ├── orders.ts      # POST /api/orders, GET /api/orders/:id, PATCH /api/orders/:id/status
│   └── returns.ts     # POST /api/returns, GET /api/returns/:id
├── schemas/
│   ├── auth.ts        # zod schemas: Register, Login, Refresh, Logout
│   ├── user.ts        # zod schemas: PatchUser, ReviewRiderApplication
│   ├── rider.ts       # zod schemas: UpdateRiderProfile, RiderStatus, UploadRiderDocument
│   ├── order.ts       # zod schemas: CreateOrder, UpdateOrderStatus
│   └── return.ts      # zod schema: CreateReturn
└── types/express.d.ts # augments Request with `user`
prisma/
├── schema.prisma      # User, RefreshToken, RiderDocument, Order/OrderEvent/OrderDecline, Return, Notification + enums
├── migrations/        # Prisma migration history
├── seed.ts            # admin user seed script
└── seed-demo.ts       # demo rider + pending orders + a return + notifications
docker/
└── init-db.sql        # creates eztech_test on first container start
tests/
├── auth.test.ts       # integration tests for /api/auth/*
├── users.test.ts      # integration tests for /api/users/*
├── rider.test.ts      # integration tests for /api/rider/* + /api/orders/* + /api/returns/* + onboarding
├── health.test.ts     # smoke test for /api/health
├── globalSetup.ts     # runs migrate deploy + seed before suite
├── helpers/db.ts      # truncateAuthTables / truncateRiderTables helpers
└── setup.ts           # loads .env.test before test modules
```
