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
# --omit=dev alone still installs `typescript` here: @prisma/client declares it as an OPTIONAL
# peerDependency, and since it's also a root devDependency npm marks it "devOptional" in the
# lockfile and installs it anyway to satisfy the peer, even under --omit=dev. Add --omit=optional
# --omit=peer so no devDependency leaks into the runtime layer (verified: DEPLOY-01 proof).
RUN npm ci --omit=dev --omit=optional --omit=peer
# npm ci --omit=dev does NOT regenerate the Prisma client (no postinstall script) — copy the
# already-generated client + query engine binary from the stage that ran `prisma generate`.
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
RUN useradd --system --uid 1001 nodeapp && chown -R nodeapp:nodeapp /app
USER nodeapp
EXPOSE 3001
# Preserve the Sentry --import flag exactly as the existing `start` script does.
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]
