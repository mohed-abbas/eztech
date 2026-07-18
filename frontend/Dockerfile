# Production image — nuxi build in a build stage, copy the Nitro node-server output into a
# slim runner. No native/Prisma deps on the frontend side, so alpine is fine for the runner.
FROM node:22-bookworm-slim AS build
WORKDIR /app
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
