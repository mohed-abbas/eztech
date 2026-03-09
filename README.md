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

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### Backend (Phase 2)

```bash
cd backend
# Instructions will be added when backend development begins
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_USE_MOCK` | `true` | Use local JSON mock data instead of API |
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API URL (when mock is disabled) |

## Mock Credentials

| Role | Email | Password |
|------|-------|----------|
| Customer | `marie@example.com` | `password123` |
| Customer | `thomas@example.com` | `password123` |
| Admin | `admin@eztech.fr` | `admin123` |

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
