# Simple Dockerfile for NestJS API (Development)

FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN pnpm prisma generate

# Copy app code
COPY apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["pnpm", "run", "start:dev"]

