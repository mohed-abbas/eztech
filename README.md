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

From the `eztech/` directory:

```bash
docker compose up --build
```

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

> Don't also run `backend/docker-compose.yml` (Postgres-only) at the same time — both publish host
> port 5432 and will conflict. The root `docker-compose.yml` is the canonical dev stack.

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
docker compose up -d          # Postgres only (backend/docker-compose.yml)
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
