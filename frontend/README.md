# EzTech Frontend

Nuxt 4 + Vue 3 + Tailwind CSS v4 + shadcn-vue. Frontend for the EzTech tech-accessory rental platform.

## Prérequis

- Node.js 20+
- npm 10+ (pnpm or yarn also supported)

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

## Lancer en développement

```bash
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

## Scripts

| Commande          | Description                           |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Serveur de développement avec HMR     |
| `npm run build`   | Build de production                   |
| `npm run preview` | Prévisualiser le build de production  |
| `npm run generate`| Génération statique                   |

## Configuration mock

Le frontend fonctionne en mode mock par défaut (données lues depuis `app/data/mock/*.json`).

```env
# .env
VITE_USE_MOCK=true                          # mode mock on (défaut)
VITE_API_URL=http://localhost:3001/api      # utilisé quand VITE_USE_MOCK=false
```

## Identifiants de test

Tous les comptes mock utilisent le mot de passe `password123`.

| Rôle    | Email                  |
| ------- | ---------------------- |
| Client  | `marie@example.com`    |
| Client  | `sophie@example.com`   |
| Livreur | `lucas@example.com`    |
| Livreur | `camille@example.com`  |

## Flux de test bout en bout

1. Se connecter avec `marie@example.com` / `password123`
2. Aller sur `/cart` — utiliser le bouton « Remplir avec des articles de démo »
3. Cliquer « Passer au paiement »
4. Choisir une adresse enregistrée (dans la zone Paris Centre / Est) ou « Ma position »
5. Carte test : `4242 4242 4242 4242` (succès) / `4242 4242 4242 0000` (échec)
6. Suivi automatique redirige vers `/orders/<id>`

## Zones de service (mock)

La vérification de zone utilise Turf.js et `app/data/mock/service-zones.json` :

- **Paris Centre** (actif) : env. 2.30–2.385 E, 48.835–48.880 N
- **Paris Est** (actif) : env. 2.385–2.460 E, 48.835–48.880 N
- **Paris Ouest** (inactif — tester le rejet)

## Structure du projet

```
frontend/
├── app/
│   ├── assets/              # CSS Tailwind et images
│   ├── components/
│   │   ├── ui/              # shadcn-vue primitives (Button, Card, Input, …)
│   │   └── LeafletMap.client.vue
│   ├── composables/
│   │   ├── useAuth.ts       # authentification mock + localStorage
│   │   ├── useCart.ts       # panier + localStorage + pricing tiered/flat
│   │   ├── useMock.ts       # drapeau VITE_USE_MOCK
│   │   └── useServiceZone.ts # point-in-polygon Turf.js
│   ├── data/mock/           # JSON mock (produits, commandes, users, zones…)
│   ├── layouts/             # auth.vue, default
│   ├── middleware/
│   │   └── auth.ts          # garde les routes protégées
│   └── pages/
│       ├── index.vue        # landing
│       ├── login.vue, register.vue, forgot-password.vue
│       ├── products/        # catalogue
│       ├── cart.vue         # panier
│       ├── checkout.vue     # paiement + adresse + zone
│       ├── orders/          # listing + détail suivi
│       ├── profile.vue
│       ├── rider/           # dashboard livreur
│       └── prototype/map.vue
├── nuxt.config.ts
├── package.json
└── tailwind.config (via @tailwindcss/vite)
```

## Routes protégées

Les pages suivantes utilisent le middleware `auth` et redirigent vers `/login?redirect=…` si non authentifié :

- `/cart`
- `/checkout`
- `/orders`, `/orders/:id`
- `/profile`

## Dépendances clés

- **Nuxt 4** — framework
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **shadcn-vue** / **reka-ui** / **radix-vue** — composants UI
- **Leaflet** — carte de suivi livraison
- **@turf/boolean-point-in-polygon** — validation zone de service
- **@vueuse/motion** — animations scroll
- **lucide-vue-next** — icônes

## Notes Phase 1

Ce frontend est livré en mode mock pour la soumission de la Phase 1 (13 avril 2026). La Phase 2 branchera l'API Express + PostgreSQL + MongoDB en réglant `VITE_USE_MOCK=false`.
