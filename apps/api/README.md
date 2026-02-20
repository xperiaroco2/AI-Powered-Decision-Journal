# NestJS API Backend

Backend API for AI-Powered Decision Journal.

## Phase 1: Foundation ✅

**Implemented**:
- ✅ Minimal NestJS bootstrap (main.ts + app.module.ts)
- ✅ PrismaModule (global)
- ✅ QueueModule (global, 3 queues)
- ✅ AuthModule (JWT validation)

**Not yet implemented**:
- Dashboard module
- Decisions module
- Attachments module
- Advice module

---

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env

# 3. Update .env with your values
# IMPORTANT: JWT_SECRET must match apps/web/.env

# 4. Generate Prisma client
pnpm prisma generate

# 5. Start development server
pnpm run start:dev
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://app:app@localhost:5432/app"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication (MUST match apps/web/.env)
JWT_SECRET="your-secret-here"

# CORS
WEB_URL="http://localhost:3000"

# Server
PORT=4000
```

---

## File Structure

```
apps/api/
├── src/
│   ├── main.ts                    # Bootstrap
│   ├── app.module.ts              # Root module
│   │
│   ├── prisma/                    # Global module
│   │   ├── prisma.service.ts      # Prisma client wrapper
│   │   └── prisma.module.ts
│   │
│   ├── queue/                     # Global module
│   │   ├── queue.service.ts       # BullMQ client (3 queues)
│   │   └── queue.module.ts
│   │
│   └── auth/                      # JWT validation
│       ├── jwt.strategy.ts        # Passport JWT strategy
│       ├── jwt-auth.guard.ts      # Route guard
│       ├── current-user.decorator.ts
│       └── auth.module.ts
│
├── prisma/
│   └── schema.prisma              # Copy of ../../prisma/schema.prisma
│
├── .env.example
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## Modules

### PrismaModule (Global)
- Provides database access
- Auto-connects on module init
- Auto-disconnects on module destroy

### QueueModule (Global)
- Manages 3 BullMQ queues:
  - `decision-analysis` (analysis runs)
  - `decision-embedding` (decision embeddings)
  - `attachment-embedding` (attachment chunking)
- Methods:
  - `enqueueAnalysisRun(runId: string)`
  - `enqueueDecisionEmbedding(decisionId: string)`
  - `enqueueAttachmentEmbedding(attachmentId: string, filename?: string)`

### AuthModule
- JWT validation using NextAuth tokens
- Exports:
  - `JwtAuthGuard` - Protect routes
  - `CurrentUser` decorator - Extract user from request

---

## Testing

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Start NestJS
pnpm run start:dev

# Test
curl http://localhost:4000
```

---

## Next Steps

Phase 2: Implement business logic modules
- Dashboard module
- Decisions module
- Attachments module
- Advice module

