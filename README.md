# EzTech


EzTech est une boutique en ligne de location de matériel technologique à Paris, avec livraison à la demande en quelques minutes : les utilisateurs choisissent leurs équipements (chargeurs, ordinateurs portables, écrans, périphériques), puis un livreur indépendant les récupère en entrepôt pour les acheminer rapidement.

Le projet est instrumenté avec une stack d’observabilité 100 % open source et auto-hébergée : GlitchTip pour le suivi des erreurs et Umami pour l’analytique du tunnel d’achat. L’ensemble de l’infrastructure (application, bases de données et monitoring) **se lance avec une seule commande** : `docker compose up`.



## Lancer toute la stack en une commande

Depuis le dossier `eztech/` :

```bash
cp .env.example .env       # 1. créer le fichier d'environnement
# 2. générer les 3 secrets et les coller dans .env (voir ci-dessous)
docker compose up --build  # 3. démarrer l'ensemble
```

Cette commande démarre **9 services** :

| Service | URL | Rôle |
|---------|-----|------|
| Frontend (Nuxt) | http://localhost:3000 | Boutique e-commerce |
| Backend API (Express) | http://localhost:3001/api | API + migrations/seed au démarrage |
| Postgres (application) | localhost:5432 | Base de la boutique (`eztech_dev`) |
| Adminer | http://localhost:8080 | Interface d'administration de la base |
| **GlitchTip** | http://localhost:8000 | Centralisation des erreurs |
| **Umami** | http://localhost:3002 | Analytique du tunnel (login `admin` / `umami`) |

En plus, en interne (sans port exposé) : la **base Postgres dédiée de GlitchTip**, son **cache
Valkey/Redis** (tâches de fond), et la **base Postgres dédiée d'Umami**. Chaque outil a donc sa
propre base, isolée de celle de l'application. Les trois bases utilisent des **volumes persistants**.

### Les 3 secrets obligatoires

Avant le premier lancement, générer trois valeurs et les renseigner dans `.env` :

```bash
openssl rand -hex 32    # à lancer 3 fois → JWT_SECRET, GLITCHTIP_SECRET_KEY, UMAMI_APP_SECRET
```

> GlitchTip embarque Django + un worker + Valkey : la stack complète est gourmande en RAM — sans
> problème pour une démo, mais nettement plus lourde que l'application seule.

## Câblage de la télémétrie (une fois)

Les outils auto-hébergés génèrent eux-mêmes leurs clés : l'application ne leur envoie de données
qu'une fois ces clés collées dans `.env`.

1. Lancer `docker compose up`. Ouvrir **GlitchTip** (http://localhost:8000) → créer une organisation
   et un projet → copier son **DSN**.
2. Ouvrir **Umami** (http://localhost:3002, login `admin` / `umami`) → ajouter un site web → copier
   son **website id**.
3. Renseigner dans `.env` :
   - `NUXT_PUBLIC_SENTRY_DSN=http://<clé>@localhost:8000/<id-projet>` (navigateur)
   - `NUXT_SENTRY_DSN` et `SENTRY_DSN` = même clé mais hôte `glitchtip:8080` (serveur Nuxt + backend,
     réseau interne Docker)
   - `NUXT_PUBLIC_UMAMI_HOST=http://localhost:3002` et `NUXT_PUBLIC_UMAMI_WEBSITE_ID=<id>`
4. Relancer la stack. Naviguer et déclencher une erreur de paiement : les erreurs arrivent dans
   GlitchTip, les pages vues et événements dans Umami.

> Ces clés sont propres à chaque machine (stockées dans les volumes Docker locaux). Un `.env` vide
> laisse le SDK Sentry et le script Umami **inertes** — c'est le comportement par défaut.

## Ce qui est instrumenté

### GlitchTip (erreurs)
- Capture **automatique** des exceptions JavaScript non gérées (frontend et backend).
- **Bouton de paiement défaillant** : échoue volontairement ~1 fois sur 3 (taux réglable via
  `NUXT_PUBLIC_PAYMENT_FAIL_RATE`) pour valider la remontée d'alertes. Panne conservée à dessein.
- Suivi de performance sur la page de validation de commande.

### Umami — plan de marquage du tunnel
| Événement | Déclenchement | Propriétés |
|-----------|---------------|------------|
| `view_product` | Consultation d'une fiche produit | id, nom, catégorie, prix |
| `add_to_cart` | Ajout au panier | id, nom, quantité, prix |
| `checkout_start` | Accès au formulaire de paiement | nombre d'articles, total |
| `checkout_success` | Paiement réussi | montant, nombre d'articles, origine du trafic |

Aucune donnée personnelle n'est envoyée à Umami ni à GlitchTip (respect RGPD).

## Commandes utiles

```bash
docker compose down          # arrêter
docker compose down -v       # arrêter + effacer les bases (re-seed au prochain up)
docker compose up --build    # reconstruire après changement de dépendances
docker compose logs -f backend
```

## Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Client | `marie@example.com` | `password123` |
| Livreur | `rider@eztech.fr` | `riderpass123` |
| Admin | `admin@eztech.fr` | `change-me` |



## Stack technique

| Domaine | Techno |
|---------|--------|
| Frontend | Nuxt 4, Vue 3, TypeScript, Tailwind 4, Pinia |
| Backend | Node 22, Express 5, TypeScript, Prisma |
| Paiement | Stripe (mode simulé activable) |
| Erreurs | GlitchTip (SDK Sentry) + Postgres + Valkey |
| Analytique | Umami + Postgres |
| Orchestration | Docker Compose |
