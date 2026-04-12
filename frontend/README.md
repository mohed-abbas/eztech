# EzTech Frontend

Plateforme de location de matériel tech livrée à Paris. Built with **Nuxt 4**, **Vue 3**, **TypeScript**, **Tailwind CSS v4**, **Pinia**, **Zod** and **shadcn-vue**.

## Sommaire

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Screens](#screens)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancement en développement](#lancement-en-développement)
- [Scripts](#scripts)
- [Configuration mock](#configuration-mock)
- [Identifiants de test](#identifiants-de-test)
- [Flux de test bout en bout](#flux-de-test-bout-en-bout)
- [Zones de service](#zones-de-service-mock)
- [Structure du projet](#structure-du-projet)
- [Routes protégées](#routes-protégées)
- [Dépendances clés](#dépendances-clés)
- [Limites et améliorations possibles](#limites-et-améliorations-possibles)

## Présentation

EzTech est une application web de location d'équipement tech (ordinateurs, appareils photo, accessoires) livrée à domicile dans Paris. L'utilisateur parcourt le catalogue, ajoute des produits au panier avec une **durée de location paramétrable** (heure / jour / semaine) pour les produits à tarification progressive, choisit une adresse de livraison validée par une **vérification de zone géographique**, puis règle sa commande par carte bancaire (paiement mocké).

Le frontend est livré en **mode mock** pour la Phase 1 : toutes les données (produits, utilisateurs, zones de service) sont lues depuis des fichiers JSON, et le "paiement" est une simulation locale. La Phase 2 branchera l'API Express + PostgreSQL + MongoDB via la variable `VITE_USE_MOCK=false`.

## Fonctionnalités

- **Authentification multi-rôles** (client / livreur) avec store Pinia + persistance `localStorage`
- **Catalogue produits** avec fiches détaillées et tarification à paliers (location à l'heure, à la journée, à la semaine)
- **Panier dynamique** : stepper quantité (via `defineModel`), sélecteur de durée (`v-model:value` + `v-model:unit`), recalcul instantané du total
- **Checkout avec 3 modes d'adresse** :
  1. Sélection parmi les adresses enregistrées du compte
  2. Saisie manuelle d'une adresse
  3. Géolocalisation navigateur (`navigator.geolocation`)
- **Validation de zone de service** avec Turf.js (point-in-polygon sur `service-zones.json`) : commandes refusées hors zone
- **Paiement mocké** avec cartes de test (succès / échec) et écran de succès animé
- **Suivi de commande** avec carte Leaflet temps réel (Phase 1 : animation mockée)
- **Formulaires validés** via schémas **Zod** partagés (login, register client, register livreur, forgot-password)
- **Middleware Nuxt `auth`** protégeant `/cart`, `/checkout`, `/orders`, `/profile`
- **Composants réutilisables** : `QuantityStepper`, `DurationSelector`, `CartItemRow`, `PriceSummary`, `EmptyState`, `AddressCard`, `ZoneBadge`, `FormField`, `LeafletMap`

## Screens

| Page | Capture |
|---|---|
| Landing — hero, stats, catalogue teaser | ![Landing](./docs/screens/01-landing.png) |
| Login — validation Zod, comptes de test visibles | ![Login](./docs/screens/02-login.png) |
| Panier — stepper quantité + sélecteur de durée + recap | ![Panier](./docs/screens/03-cart.png) |
| Checkout — sélection d'adresse, badge de zone, carte | ![Checkout](./docs/screens/04-checkout.png) |
| Register — toggle Customer / Rider, validation Zod | ![Register](./docs/screens/05-register.png) |

## Prérequis

- Node.js 20+
- npm 10+ (pnpm ou yarn supportés)

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

## Lancement en développement

```bash
npm run dev
```

L'application est disponible sur `http://localhost:3000` (ou `3001` si le port 3000 est occupé).

## Scripts

| Commande           | Description                           |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Serveur de développement avec HMR     |
| `npm run build`    | Build de production                   |
| `npm run preview`  | Prévisualiser le build de production  |
| `npm run generate` | Génération statique                   |

## Configuration mock

Le frontend fonctionne en mode mock par défaut (données lues depuis `app/data/mock/*.json`).

```env
# .env
VITE_USE_MOCK=true                          # mode mock on (défaut)
VITE_API_URL=http://localhost:3001/api      # utilisé quand VITE_USE_MOCK=false
```

La bascule se fait via `app/composables/useMock.ts`, lu depuis `runtimeConfig.public.useMock` dans `nuxt.config.ts`.

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
4. Choisir une adresse enregistrée (zone Paris Centre ou Paris Est) ou « Ma position »
5. Carte test : `4242 4242 4242 4242` (succès) / `4242 4242 4242 0000` (échec)
6. Redirection automatique vers `/orders/<id>` avec suivi de livraison

## Zones de service (mock)

La vérification de zone utilise Turf.js et `app/data/mock/service-zones.json` :

- **Paris Centre** (actif) : env. 2,30–2,385 E, 48,835–48,880 N
- **Paris Est** (actif) : env. 2,385–2,460 E, 48,835–48,880 N
- **Paris Ouest** (inactif — tester le rejet de zone)

## Structure du projet

```
frontend/
├── app/
│   ├── assets/              # CSS Tailwind et images
│   ├── components/
│   │   ├── ui/              # primitives shadcn-vue (Button, Card, Input, …)
│   │   ├── AddressCard.vue       # carte d'adresse sélectionnable
│   │   ├── CartItemRow.vue       # ligne de panier réutilisable
│   │   ├── DurationSelector.vue  # v-model:value + v-model:unit
│   │   ├── EmptyState.vue        # état vide avec slots nommés
│   │   ├── FormField.vue         # wrapper label + input + erreur
│   │   ├── LeafletMap.client.vue # carte suivi livraison
│   │   ├── PriceSummary.vue      # récap prix avec slots
│   │   ├── QuantityStepper.vue   # defineModel<number>
│   │   └── ZoneBadge.vue         # badge de zone de service
│   ├── composables/
│   │   ├── useMock.ts            # drapeau VITE_USE_MOCK
│   │   └── useServiceZone.ts     # point-in-polygon Turf.js
│   ├── stores/
│   │   ├── auth.ts               # Pinia store auth + adresses
│   │   └── cart.ts               # Pinia store panier + pricing
│   ├── lib/
│   │   └── schemas.ts            # schémas Zod (login, register, …)
│   ├── data/mock/                # JSON mock (produits, commandes, zones, …)
│   ├── layouts/                  # auth.vue, default
│   ├── middleware/
│   │   └── auth.ts               # garde routes protégées
│   └── pages/
│       ├── index.vue             # landing
│       ├── login.vue, register.vue, forgot-password.vue
│       ├── products/             # catalogue
│       ├── cart.vue              # panier
│       ├── checkout.vue          # paiement + adresse + zone
│       ├── orders/               # listing + détail suivi
│       ├── profile.vue
│       └── rider/                # dashboard livreur
├── docs/screens/                 # captures pour ce README
├── nuxt.config.ts
└── package.json
```

## Routes protégées

Les pages suivantes utilisent le middleware `auth` et redirigent vers `/login?redirect=…` si non authentifié :

- `/cart`
- `/checkout`
- `/orders`, `/orders/:id`
- `/profile`

## Dépendances clés

- **Nuxt 4** — framework
- **Vue 3** + **Composition API** + **`<script setup>`**
- **TypeScript** partout
- **Pinia** (`@pinia/nuxt`) — état global (auth, panier)
- **Zod** — schémas de validation des formulaires
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **shadcn-vue** / **reka-ui** / **radix-vue** — composants UI
- **Leaflet** + **@types/leaflet** — carte de suivi livraison
- **@turf/boolean-point-in-polygon** + **@turf/helpers** — validation zone de service
- **@vueuse/motion** — animations scroll
- **lucide-vue-next** — icônes

## Limites et améliorations possibles

### Limites actuelles (Phase 1 — mock)

- **Aucun backend** : toutes les requêtes sont mockées, pas de persistance serveur. Les commandes et le panier sont stockés dans `localStorage`.
- **Paiement simulé** : pas d'intégration Stripe réelle. La validation de carte est basée sur les derniers chiffres (`…0000` → échec).
- **Suivi de commande animé** : la position du livreur est interpolée côté client, pas de WebSocket ni de géolocalisation réelle du livreur.
- **OAuth non fonctionnel** : les boutons « Continue with Google » sont des placeholders.
- **Pas de tests unitaires** : aucun harness Vitest en place (bonus non implémenté pour la Phase 1).
- **Géocodage inverse manquant** : en mode « saisie manuelle », aucune coordonnée n'est résolue, donc la validation de zone est ignorée si l'utilisateur ne passe pas par « Ma position » ou une adresse enregistrée.
- **Pas de reset password réel** : la page `/forgot-password` est cosmétique en mode mock.
- **Pas de dashboard / graphiques** : le dashboard livreur est un listing simple (bonus non implémenté).

### Améliorations prévues (Phase 2)

- **Backend Express + PostgreSQL + MongoDB** branché via `VITE_USE_MOCK=false`
- **Intégration Stripe** réelle avec 3DS
- **WebSocket** pour suivi livreur temps réel
- **Geocoding** via Mapbox / HERE pour résoudre les adresses saisies manuellement
- **Tests unitaires Vitest** sur stores, schémas Zod, et composants clés
- **Dashboard admin** avec graphiques (Chart.js) : CA, commandes par zone, taux de conversion
- **Notifications push** via `@vueuse/useWebNotification`
- **i18n** (`@nuxtjs/i18n`) pour basculer FR / EN
- **PWA** pour installation mobile
- **Tests E2E** Playwright sur le flux panier → paiement → commande
