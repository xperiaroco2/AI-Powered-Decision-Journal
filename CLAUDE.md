# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

All services are started via Docker Compose. Never start services manually via terminal.

```bash
docker-compose up -d           # Start all services
docker-compose up -d --build   # Rebuild images after code changes
docker-compose down            # Stop all services
docker-compose logs -f api     # Tail logs for a specific service (api | worker | web)
```

Services and ports:
- `web` → http://localhost:80 (Next.js)
- `api` → http://localhost:4000 (NestJS)
- `grafana` → http://localhost:3001 (admin/admin)
- `prometheus` → http://localhost:9090

## Build / Lint / Test

These are the only commands run via terminal (not Docker).

### API (`apps/api`) — NestJS

```bash
cd apps/api
pnpm build                          # Compile TypeScript
pnpm lint                           # ESLint (auto-fixes)
pnpm test                           # Unit tests (Jest)
pnpm test -- --testPathPattern=foo  # Single test file
pnpm test:integration               # Integration tests (Testcontainers — spins up real Postgres + Redis)
pnpm test:all                       # Unit + integration
```

### Worker (`apps/worker`) — BullMQ

```bash
cd apps/worker
pnpm build                 # prisma generate + tsc
pnpm test                  # Unit tests
pnpm test:integration      # Integration tests (Testcontainers)
pnpm test:all
```

### Web (`apps/web`) — Next.js

```bash
cd apps/web
pnpm build                 # next build + tsc (server)
pnpm lint                  # ESLint
pnpm test                  # Unit tests (Jest + jsdom)
pnpm test:e2e              # Playwright E2E
pnpm test:e2e:ui           # Playwright interactive UI
```

### Database Migrations

```bash
cd apps/api && pnpm exec prisma migrate dev   # Create + apply migration (dev)
pnpm db:migrate                               # Deploy migrations (production, from root)
pnpm db:generate                              # Regenerate Prisma client (root schema)
```

## Architecture

Pnpm monorepo (`pnpm-workspace.yaml`) with three apps. All infrastructure runs in Docker.

### System Overview

```
Browser
  │  HTTP / WebSocket
  ▼
apps/web  (Next.js, port 3000 in dev / 80 in Docker)
  │  Next.js API routes are THIN PROXIES — no business logic
  │  lib/api-proxy.ts forwards requests with JWT to NestJS
  ▼
apps/api  (NestJS, port 4000)
  │  All business logic, auth, validation, DB access
  ├─ enqueues jobs ──► Redis (BullMQ queues)
  └─────────────────── PostgreSQL (pgvector/pg15)
                            ▲
apps/worker (plain Node.js) │
  ├─ consumes jobs from Redis
  ├─ calls AI (Groq) / Embedding (OpenAI) providers
  ├─ writes results to PostgreSQL
  └─ publishes events to Redis pub/sub
                            │
  apps/web Socket.IO server ◄── Redis pub/sub ── worker
  │  (attaches via Redis adapter)
  ▼
Browser receives real-time status updates
```

### `apps/api` — NestJS Backend

Standard NestJS module structure. Every feature has `module.ts`, `controller.ts`, `service.ts`, and `dto/`.

| Module | Responsibility |
|---|---|
| `auth/` | JWT login/register, `JwtAuthGuard`, `@CurrentUser()` decorator |
| `decisions/` | Decision CRUD, triggering analysis reruns |
| `attachments/` | File upload (PDF/DOCX parsing), text extraction |
| `advice/` | RAG advisory — decision-based and attachment-based retrieval |
| `dashboard/` | Aggregate stats for charts |
| `queue/` | BullMQ queue client — enqueues jobs only, never processes them |
| `observability/` | OpenTelemetry traces + metrics + pino structured logging |
| `prisma/` | Shared `PrismaService`; schema at `apps/api/prisma/schema.prisma` |

**Critical:** `apps/api/src/otel.ts` must remain the very first import in `main.ts`. It patches http/express/ioredis/prisma before NestJS loads them.

### `apps/web` — Next.js Frontend

Uses a **custom HTTP server** (`server.ts`) to mount Socket.IO on the same port as Next.js. This means the app starts with `tsx server.ts`, never `next dev` or `next start` directly.

Key files:
- `lib/api-proxy.ts` — `proxyGET`, `proxyPOST`, `proxyMultipartPOST` helpers used in every API route
- `lib/api-client.ts` — Client-side fetch with automatic JWT injection
- `lib/auth-context.tsx` — React context for auth state (access token, user info)
- `lib/socket.ts` — **Server-side** Socket.IO initialisation (Redis adapter for pub/sub). Client components consume events via hooks (e.g. `hooks/useDecisionUpdates.ts`), not directly from this file.

### `apps/worker` — BullMQ Worker

Plain Node.js process. Three queues processed concurrently:

| Queue name | Concurrency | What it does |
|---|---|---|
| `decision-analysis` | 5 | Runs AI analysis via Groq or mock provider |
| `decision-embedding` | 10 | Generates OpenAI embeddings for decisions |
| `attachment-embedding` | 3 | Chunks + embeds uploaded documents |

Providers are selected by env var at startup — `AI_PROVIDER=mock|groq`, `EMBEDDING_PROVIDER=mock|openai`. Mock providers work without any API keys.

### Database Schema

Canonical schema: `apps/api/prisma/schema.prisma`. The root `prisma/schema.prisma` is a copy used by the worker — **keep both in sync** when making schema changes.

Key models:
- `Decision` — `status` uses `DecisionStatus` enum: `PENDING → PROCESSING → DONE | FAILED`. `latestRunId` points to the most recent run.
- `DecisionAnalysisRun` — `status` uses a **separate** `AnalysisRunStatus` enum: `PENDING | PROCESSING | COMPLETED | FAILED`. Note `COMPLETED` ≠ `DONE` — the run uses `COMPLETED`, the decision uses `DONE`. Stores `resultJson` plus denormalized `categoryText` / `biasesText` fields for fast dashboard aggregations.
- `DecisionEmbedding` — `vector(1536)` pgvector column (one-to-one with Decision)
- `Attachment` → `AttachmentChunk` → `AttachmentChunkEmbedding` — RAG document pipeline (500-token chunks, 100 overlap)

All vector columns use `Unsupported("vector(1536)")` in Prisma. Vector similarity queries must use `prisma.$queryRawUnsafe`.

## Coding Conventions

### API (NestJS)

- All routes are protected with `@UseGuards(JwtAuthGuard)` at the controller level unless explicitly public
- Use `@CurrentUser()` decorator to extract the authenticated user — never trust IDs from request bodies
- All request bodies validated with class-validator DTOs (`whitelist: true`, `forbidNonWhitelisted: true`)
- Services own all business logic; controllers are thin (validate → call service → return)
- Throw NestJS HTTP exceptions (`NotFoundException`, `ForbiddenException`, etc.) from services, not controllers
- Every service method checks `userId` ownership before returning or mutating data — no cross-user data leakage
- Queue jobs are enqueued via `QueueService`, never created directly in services
- **Logging**: inject `Logger` from `@nestjs/common` via `private readonly logger = new Logger(ClassName.name)`. For module-level functions (singletons, factories), use a module-scoped `const logger = new Logger('ContextName')`. Never use `console.log/error/warn`.

### Worker

- Processors (`src/processors/`) are pure async functions — no class instances, no shared state
- AI and embedding providers are selected once at startup via factory functions (`getAIProvider()`, `getEmbeddingProvider()`)
- Use `AI_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` in development — no API keys needed
- **Logging**: use `childLogger('context-name')` from `src/logger.ts`. Each file creates a file-scoped `const log = childLogger('name')`. Use structured fields: `log.info({ jobId, decisionId }, 'message')`. Never use `console.log/error/warn`.

### Web (Next.js)

- Next.js API routes (`app/api/`) contain only proxy logic using `lib/api-proxy.ts` — no business logic
- Client components use `lib/api-client.ts` for all API calls (handles JWT injection automatically)
- Use `"use client"` only when needed (event handlers, hooks, browser APIs)
- Tailwind CSS v4 for all styling; dark mode via `next-themes` with `dark:` variants
- Socket.IO server is initialised in `lib/socket.ts`; client components receive real-time events via hooks (e.g. `hooks/useDecisionUpdates.ts`)

### Testing

- **API unit tests**: mock `PrismaService` and `QueueService` with `jest.fn()` objects; use `@nestjs/testing` `Test.createTestingModule`
- **API integration tests**: use `@testcontainers/postgresql` and `@testcontainers/redis` — real infrastructure, no mocks
- **Worker unit tests**: mock the Prisma client and provider calls directly
- Coverage thresholds enforced: 70% branches, 75% functions, 80% lines/statements (both api and worker)

## Making Changes Safely

### Before changing anything

1. Run the relevant tests to establish a baseline: `pnpm test` in the affected app
2. For schema changes, always update **both** `apps/api/prisma/schema.prisma` and `prisma/schema.prisma`

### API changes

- Adding a new endpoint: create `dto/`, add method to service, add route to controller, register in module
- All new endpoints must be covered by a unit test (mock Prisma) and ideally an integration test
- After schema changes: `cd apps/api && pnpm exec prisma migrate dev`, then `pnpm db:generate`

### Worker changes

- After modifying queue names, update both the worker config files (`src/config/`) and `QueueService` in the API — queue names must match exactly
- Run `pnpm build` to catch TypeScript errors before testing in Docker

### Web changes

- New API calls go through `lib/api-client.ts` — do not call the NestJS API directly from components
- New API routes must use `proxyGET`/`proxyPOST` from `lib/api-proxy.ts`
- After changes, run `pnpm build` to catch Next.js build errors (type errors, invalid server/client boundaries)

### Verifying changes end-to-end

```bash
# 1. Run unit tests for affected app
cd apps/api && pnpm test

# 2. Run integration tests if touching DB or queue logic
cd apps/api && pnpm test:integration

# 3. Rebuild Docker image and verify service starts cleanly
docker-compose up -d --build api
docker-compose logs -f api
```

## Environment Variables

`.env` lives at the repository root. Web and worker load it via relative path (`../../.env`).

```
DATABASE_URL=postgresql://app:app@localhost:5432/app
REDIS_URL=redis://localhost:6379
JWT_SECRET=<random string>          # signs access tokens (15m expiry)
JWT_REFRESH_SECRET=<random string>  # signs refresh tokens (7d expiry)
AI_PROVIDER=mock              # mock (no key needed) | groq
GROQ_API_KEY=                 # required if AI_PROVIDER=groq
EMBEDDING_PROVIDER=mock       # mock (no key needed) | openai
OPENAI_API_KEY=               # required if EMBEDDING_PROVIDER=openai
API_URL=http://localhost:4000  # web → NestJS (overridden in Docker to http://api:4000)
WEB_URL=http://localhost:3000  # NestJS CORS origin
```

## Claude Behavior Rules

Claude should follow these rules when working in this repository:

1. Read only the files relevant to the task first.
2. Briefly explain the plan before making meaningful changes.
3. Make small, focused changes instead of large broad refactors.
4. Avoid modifying unrelated files.
5. Preserve the existing architecture unless a refactor is explicitly requested.
6. After code changes, run the smallest relevant verification commands first.
7. Update documentation when behavior, setup, architecture, or developer workflow changes.
8. Prefer consistency with existing patterns over inventing new abstractions.

Claude should not make speculative architectural changes without first confirming they fit the current system design.

## Repository Analysis Policy

When analyzing this repository, Claude should:

- avoid scanning the entire repository unless explicitly asked
- prefer targeted inspection of relevant apps, modules, and files
- use the repository structure and this CLAUDE.md as the primary guide
- avoid re-reading large files if the task is narrow
- analyze one app at a time when possible (`apps/api`, `apps/web`, `apps/worker`)

For small tasks, Claude should inspect only the directly affected files and their immediate dependencies.

## Git Workflow

Preferred workflow for Claude:

1. analyze the task
2. inspect relevant files
3. propose a short implementation plan
4. implement the change
5. run relevant lint / build / test commands
6. summarize what changed
7. propose a commit message

Claude should not push, create remote branches, or open pull requests unless explicitly instructed.

Claude should avoid destructive git commands unless explicitly requested.

## Observability Guidance

This system includes production observability and Claude should preserve it when making backend or worker changes.

Observability stack:
- OpenTelemetry for tracing
- Prometheus for metrics
- Grafana for dashboards
- pino structured logging

Claude should keep observability in mind when changing critical flows such as:
- request handling
- background job processing
- external AI / embedding provider calls
- database-intensive operations
- retry / failure paths

When appropriate, Claude should extend existing logs, metrics, or traces rather than introducing ad hoc debugging patterns.

## Task Strategy

For non-trivial tasks, Claude should work in this order:

1. understand the relevant architecture
2. identify the exact files to change
3. propose a concise plan
4. implement in small steps
5. verify using the smallest relevant commands
6. summarize results and any follow-up work

For larger tasks, Claude should prefer phased implementation over one large change.

Examples:
- docs update → inspect README + relevant source files only
- API feature → inspect module, service, controller, DTOs, tests
- worker change → inspect processor, provider, queue config, related API enqueue logic
- observability change → inspect existing metrics, traces, logger usage before adding new instrumentation

## Pull Request Workflow

When Claude creates a pull request:
- create a focused branch
- keep changes minimal and scoped
- run the smallest relevant verification first
- include verification results in the PR description
- do not create unrelated refactors
- do not push or open a PR unless explicitly requested