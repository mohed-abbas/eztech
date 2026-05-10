# EzTech Backend

Express.js + TypeScript API for the EzTech rental delivery platform.

## Prerequisites

- Node.js `>=22.12.0` (use `nvm install 22 && nvm use 22`)
- npm
- PostgreSQL (local or Docker) once Prisma schema lands

## Setup

```bash
cd eztech/backend
npm install
cp .env.example .env
# edit .env — set a real DATABASE_URL and a 32+ char JWT_SECRET
npm run prisma:generate
npm run dev
```

Server boots at `http://localhost:3001`. Sanity check:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","uptime":...,"timestamp":"..."}
```

## Environment variables

See `.env.example` for the full list. All vars are validated by zod at startup; the process exits with a clear error if anything is missing or malformed.

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3001` | HTTP port |
| `DATABASE_URL` | — | Postgres connection string (required) |
| `JWT_SECRET` | — | Min 32 chars (required) |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |

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

## Project layout

```
src/
├── index.ts           # entry — starts http server
├── app.ts             # builds and exports the Express app
├── config/env.ts      # zod-validated env loader
├── lib/
│   ├── logger.ts      # pino instance
│   └── prisma.ts      # PrismaClient singleton
├── middleware/
│   ├── auth.ts        # JWT sign/verify + requireAuth
│   ├── error.ts       # central error handler + HttpError
│   └── notFound.ts    # 404 catcher
├── routes/
│   ├── index.ts       # mounts all routers under /api
│   └── health.ts      # GET /api/health
└── types/express.d.ts # augments Request with `user`
prisma/schema.prisma   # placeholder — Wilson's deliverable
tests/                 # vitest + supertest
```

## Status

This is the **foundation phase**. Coming next:
- Real Prisma schema (Wilson)
- `/api/auth/*` routes
- Orders, payments, Socket.io, notifications
- Docker Compose, CI/CD

Until those land, only `/api/health` serves real traffic.
