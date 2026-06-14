#!/bin/sh
set -e

echo "[entrypoint] waiting for postgres..."
until pg_isready -h postgres -p 5432 -U postgres -d eztech_dev >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] postgres is ready"

# Env comes from compose `environment:` (real process env). We deliberately invoke tsx WITHOUT
# --env-file so we never read or write a .env inside /app — that dir is bind-mounted to the host,
# and writing it would clobber a teammate's native-dev .env (which points at localhost, not the
# `postgres` service). The seed/dev npm scripts use --env-file, so we call tsx directly instead.

echo "[entrypoint] prisma generate"
npx prisma generate

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] seeding admin user (idempotent)"
npx tsx prisma/seed.ts

if [ "${SEED_CATALOG}" = "true" ]; then
  echo "[entrypoint] seeding catalog"
  npx tsx prisma/seed-catalog.ts || echo "[entrypoint] WARN: catalog seed failed (is the mock dir mounted?)"
fi

if [ "${SEED_DEMO}" = "true" ]; then
  echo "[entrypoint] seeding demo data"
  npx tsx prisma/seed-demo.ts || echo "[entrypoint] WARN: demo seed failed"
fi

if [ "${SEED_ZONES}" = "true" ]; then
  echo "[entrypoint] seeding delivery zones (idempotent)"
  npx tsx prisma/seed-zones.ts || echo "[entrypoint] WARN: zone seed failed (is the mock dir mounted?)"
fi

echo "[entrypoint] starting backend: $*"
exec "$@"
