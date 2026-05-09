# Build context: repository root (see docker-compose.yml).
FROM node:20-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

RUN pnpm install --frozen-lockfile
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

FROM node:20-bookworm-slim AS runner
WORKDIR /repo
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared ./packages/shared
COPY apps/backend/prisma ./apps/backend/prisma

COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/backend/node_modules ./apps/backend/node_modules

WORKDIR /repo/apps/backend
EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/main.js"]
