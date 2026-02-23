# ─── Stage 1: installer ──────────────────────────────────────────────────────
FROM node:20-slim AS installer
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Copy workspace manifests for ALL packages so pnpm can resolve the full graph
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json    ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json    ./apps/web/package.json

# Full install including devDeps
RUN pnpm install --frozen-lockfile

# pnpm deploy creates /deploy/api/node_modules as real flat files (no virtual-store
# symlinks). This is the canonical fix for "Cannot find module" in pnpm monorepos.
RUN pnpm --filter "@ai-decision-journal/api" deploy --prod --legacy /deploy/api

# Run prisma generate INSIDE the deploy dir.
# Default output path = <schemaDir>/../node_modules, so with schema at
# /deploy/api/prisma/schema.prisma the generated client lands in
# /deploy/api/node_modules/.prisma/client — exactly where @prisma/client expects it.
WORKDIR /deploy/api
COPY prisma ./prisma
RUN PATH="/app/apps/api/node_modules/.bin:$PATH" \
    prisma generate --schema=./prisma/schema.prisma

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
# Prisma query engine requires OpenSSL; node:slim strips it out
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Self-contained flat node_modules + generated Prisma client
COPY --from=installer /deploy/api ./

# Pre-built JS output (compiled outside Docker: tsc → apps/api/dist)
COPY apps/api/dist ./dist

EXPOSE 4000
# Run migrations then start the server.
# prisma is now a production dependency so the binary is in node_modules/.bin.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/src/main.js"]