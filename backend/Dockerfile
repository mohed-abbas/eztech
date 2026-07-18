# Production image — multi-stage build. Debian (not alpine), matching Dockerfile.dev's
# rationale: Prisma's query engine needs openssl without musl gymnastics. schema.prisma
# targets binaryTargets = ["native", "debian-openssl-3.0.x"], which resolves correctly
# here since every stage below IS a debian-openssl-3.0.x environment.

FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# A plain `npm ci --omit=dev --omit=optional --omit=peer` is not enough here: deploy.sh (see
# 08-VPS-CONTRACT.md) runs `docker compose run --rm --no-deps --entrypoint "npx prisma migrate
# deploy" backend-<slot>` against this EXACT image before the new slot starts, so the `prisma`
# CLI — itself a devDependency — has to stay, along with its full transitive graph (@prisma/config,
# effect, etc). Rather than chase that graph by hand, copy the already-fully-resolved `deps`
# node_modules wholesale, then delete only the specific devDependency packages we don't want in
# the runtime layer, keeping `prisma` as the one deliberate exception.
COPY --from=deps /app/node_modules ./node_modules
# npm ci --omit=dev does NOT regenerate the Prisma client (no postinstall script) — the client's
# generated output already lives under these two paths in the copied tree; re-stated explicitly
# so a `deps` stage change that stops producing them fails the build loudly instead of silently.
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
RUN rm -rf \
  node_modules/@eslint node_modules/eslint node_modules/@types \
  node_modules/typescript node_modules/typescript-eslint node_modules/prettier \
  node_modules/tsx node_modules/mongodb-memory-server node_modules/pino-pretty \
  node_modules/socket.io-client node_modules/supertest node_modules/vitest \
  node_modules/.bin/eslint node_modules/.bin/prettier node_modules/.bin/tsx \
  node_modules/.bin/tsc node_modules/.bin/tsserver node_modules/.bin/vitest
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
RUN useradd --system --uid 1001 nodeapp && chown -R nodeapp:nodeapp /app
USER nodeapp
EXPOSE 3001
# Preserve the Sentry --import flag exactly as the existing `start` script does.
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]
