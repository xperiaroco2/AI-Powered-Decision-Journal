# ─── Stage 1: installer ──────────────────────────────────────────────────────
FROM node:20-slim AS installer
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json    ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json    ./apps/web/package.json

RUN pnpm install --frozen-lockfile

RUN pnpm --filter "./apps/worker" deploy --prod --legacy /deploy/worker
# Fail fast: verify that production deps were actually deployed
RUN test -f /deploy/worker/node_modules/dotenv/package.json || \
    (echo "ERROR: dotenv missing from deploy — pnpm deploy may have silently failed" && exit 1)

WORKDIR /deploy/worker
COPY prisma ./prisma
RUN PATH="/app/apps/worker/node_modules/.bin:$PATH" \
    prisma generate --schema=./prisma/schema.prisma

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
# Prisma query engine requires OpenSSL; node:slim strips it out
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /deploy/worker ./

# Pre-built JS output (compiled outside Docker: tsc → apps/worker/dist)
COPY apps/worker/dist ./dist

CMD ["node", "dist/index.js"]