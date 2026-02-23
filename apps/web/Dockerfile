# ─── Stage 1: installer ──────────────────────────────────────────────────────
FROM node:20-slim AS installer
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json    ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json    ./apps/web/package.json

RUN pnpm install --frozen-lockfile

RUN pnpm --filter "./apps/web" deploy --prod --legacy /deploy/web
# Fail fast: verify that production deps were actually deployed
RUN test -f /deploy/web/node_modules/dotenv/package.json || \
    (echo "ERROR: dotenv missing from deploy — pnpm deploy may have silently failed" && exit 1)

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /deploy/web ./

# Pre-built assets (built outside Docker)
COPY apps/web/.next ./.next
COPY apps/web/public ./public
COPY apps/web/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]