# Build context: repository root.
FROM node:20-bookworm-slim AS build
WORKDIR /repo

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared

RUN pnpm install --frozen-lockfile
RUN pnpm --filter frontend build

FROM node:20-bookworm-slim AS runner
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared ./packages/shared

COPY --from=build /repo/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/frontend/node_modules ./apps/frontend/node_modules

WORKDIR /repo/apps/frontend
EXPOSE 3000

CMD ["pnpm", "start"]
