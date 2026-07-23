# Production image — nuxi build in a build stage, copy the Nitro node-server output into a
# slim runner. No native/Prisma deps on the frontend side, so alpine is fine for the runner.
# nuxt.config.ts reads VITE_API_URL/VITE_SOCKET_URL/VITE_STRIPE_PUBLISHABLE_KEY directly via
# process.env at nuxt.config load time (not through the NUXT_PUBLIC_ runtime-override convention),
# so these are baked in at build time. None of the three are secret — API/socket URLs are public
# endpoints and the Stripe key is the publishable (client-safe) key by design — so build ARGs are
# the correct mechanism here, unlike a real secret (never do this for STRIPE_SECRET_KEY etc.).
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL} \
    VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
COPY package.json package-lock.json ./
COPY . .
RUN npm ci
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp && chown -R nodeapp:nodeapp /app
USER nodeapp
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
