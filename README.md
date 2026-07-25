# EzTech

> Tech you need. Delivered in minutes.

On-demand tech equipment rental delivery service for Paris. Users browse and rent tech gear (chargers, laptops, monitors, peripherals), and a gig rider picks it up from a warehouse and delivers it in minutes.

## Prerequisites

- Node.js 22+ (see `frontend/.nvmrc`)
- npm

## Project Structure

```
eztech/
├── frontend/       # Nuxt.js 4 (Vue 3) — customer & rider UI
│   ├── app/
│   │   ├── assets/css/        # Tailwind config & design tokens
│   │   ├── components/ui/     # shadcn-vue components
│   │   ├── composables/       # Vue composables (useAuth, useCart, useMock...)
│   │   ├── data/mock/         # Mock JSON data for development
│   │   ├── lib/               # Utilities (cn helper)
│   │   └── pages/             # File-based routing
│   └── public/                # Static assets
│
├── backend/        # Express.js API (Phase 2)
│   └── ...
│
└── README.md
```

## Getting Started

### Run everything with Docker (recommended for dev)

The fastest way to get the full stack running — Postgres + backend + frontend — with hot reload and a
seeded database. The only prerequisite is **Docker Desktop**; you don't need Node or npm installed locally.

From the `eztech/` directory, create the three env files from their templates, set a JWT secret, then start:

```bash
cp .env.example .env                      # infra: Postgres, JWT, shared ports
cp backend/.env.example backend/.env      # backend: Stripe keys, admin seed account
cp frontend/.env.example frontend/.env    # frontend: API URL, Stripe publishable key

# JWT_SECRET ships EMPTY on purpose and compose refuses to start without it (min 32 chars).
# Generate one and paste it into JWT_SECRET= in eztech/.env :
openssl rand -base64 48

docker compose up --build
```

> **All three files are required** — `docker-compose.yml` loads `backend/.env` and `frontend/.env`
> via `env_file`, and they are gitignored, so a fresh clone has none of them and `docker compose up`
> fails until they exist. Apart from `JWT_SECRET`, the templates ship working dev defaults (Stripe
> test placeholders included), so nothing else needs editing to boot.

This starts:

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (Nuxt) | http://localhost:3000 | hot reload |
| Backend API | http://localhost:3001/api | hot reload, auto migrate + seed on boot |
| Postgres | localhost:5432 | db `eztech_dev`, user/pass `postgres`/`postgres` |
| Adminer (DB GUI) | http://localhost:8080 | visualize/query the database |

Adminer login: **System** PostgreSQL · **Server** `postgres` · **Username** `postgres` ·
**Password** `postgres` · **Database** `eztech_dev` (the server is pre-filled).

The backend runs migrations and seeds on startup: admin user, full catalog (34 products), and demo
rider/orders. Default admin: **`admin@eztech.fr` / `change-me`**.

Common commands:

```bash
docker compose down          # stop
docker compose down -v       # stop + wipe the database (re-seeds on next up)
docker compose up --build    # rebuild after package.json dependency changes
docker compose logs -f backend
docker compose exec backend sh
```

To disable demo/catalog seeding, set `SEED_DEMO=false` / `SEED_CATALOG=false` in `docker-compose.yml`.

### Telemetry / observability (optional, for the demo)

Self-hosted **GlitchTip** (error tracking) and **Umami** (web analytics) live in a separate, opt-in
overlay. They are **not** started by `docker compose up` — day-to-day dev stays lightweight, and the app
sends no telemetry unless you configure it. Bring them up alongside the app with both compose files:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up --build
```

| Service | URL | Notes |
|---------|-----|-------|
| GlitchTip (errors) | http://localhost:8000 | self-register the first account |
| Umami (analytics) | http://localhost:3002 | default login `admin` / `umami` |

> GlitchTip runs Django + a worker + Valkey, so the overlay is RAM-hungry — fine for a demo laptop,
> but expect it to use noticeably more memory than the app alone.

**One-time wiring** (self-hosted tools mint their own keys, so this can't be fully pre-baked):

1. Start the overlay (command above). Open GlitchTip → create an organization and a project → copy its **DSN**.
2. Open Umami → add a website → copy its **website id**.
3. Copy `.env.example` to `eztech/.env` (if you haven't already) and fill in:
   - `NUXT_PUBLIC_SENTRY_DSN=http://<key>@localhost:8000/<project-id>` (browser)
   - `NUXT_SENTRY_DSN` and `SENTRY_DSN` = same key but host `glitchtip:8080` (Nuxt server + backend, internal network)
   - `NUXT_PUBLIC_UMAMI_HOST=http://localhost:3002` and `NUXT_PUBLIC_UMAMI_WEBSITE_ID=<id>`
4. Restart the stack. Trigger an error and click around the app — errors land in GlitchTip, pageviews in Umami.

> **Telemetry data is per-machine.** The GlitchTip account/project (and its DSN) and the Umami website
> live in local Docker volumes (`glitchtip_postgres_data`, `umami_postgres_data`) — they are **not** in
> git or the compose file. Each developer who runs the overlay gets a **fresh, empty** GlitchTip/Umami and
> must do the one-time wiring above to get their **own** DSN/website-id. The DSN in your `.env` will not
> work on someone else's machine. Your setup persists across `up`/`down` but is wiped by `down -v`. For a
> shared/central instance, you'd host one GlitchTip everyone points at — that's the production model (Phase 7).

With those env vars empty (the default), the Sentry SDK and Umami script are inert. This is the same
switch you'd flip in production — the instrumentation code ships everywhere; only the config changes.

### Run natively (without Docker)

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

#### Backend

```bash
cd backend
npm install
cp .env.example .env          # set DATABASE_URL + a 32+ char JWT_SECRET
(cd .. && docker compose up -d postgres)   # Postgres only, from the root dev stack
npx prisma migrate deploy
npm run prisma:seed           # admin user
npm run seed:catalog          # catalog (optional)
npm run dev                   # http://localhost:3001
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_USE_MOCK` | `true` | Use local JSON mock data instead of API |
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API URL (when mock is disabled) |

## Test Credentials

These accounts are seeded into the real database (`npm run seed:demo`, run automatically by the Docker
dev stack) and also exist as frontend mock accounts:

| Role | Email | Password |
|------|-------|----------|
| Customer | `marie@example.com` | `password123` |
| Customer | `thomas@example.com` | `password123` |
| Rider | `rider@eztech.fr` | `riderpass123` |
| Admin | `admin@eztech.fr` | `change-me` |

> The admin password comes from `ADMIN_PASSWORD` (set to `change-me` in `docker-compose.yml`; change it
> for your own environment). The rider/customer accounts come from the demo seed.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Nuxt.js 4 (Vue 3, Composition API) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn-vue + Radix Vue |
| Icons | Phosphor (via @nuxt/icon) |
| Fonts | Inter, JetBrains Mono (via @nuxt/fonts) |
| Backend | Node.js + Express.js (Phase 2) |
| Database | PostgreSQL + MongoDB (Phase 2) |
| Real-time | Socket.io (Phase 2) |
| Payments | Stripe (Phase 2) |
| Auth | JWT + Google OAuth (Phase 2) |
| Containerization | Docker + Docker Compose (Phase 2) |

## Build

```bash
cd frontend
npm run build
npm run preview   # preview production build locally
```
