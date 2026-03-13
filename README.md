# AI-Powered Decision Journal

A full-stack AI-powered decision journal that helps users reflect on important
life and work decisions through asynchronous AI analysis.

The system is designed around real-world AI constraints: long-running jobs,
provider failures, retries, and real-time UI updates.

**Live Demo:** https://web-production-2239a.up.railway.app/

**Repository:** https://github.com/xperiaroco2/AI-Powered-Decision-Journal

---

## Why This Project Is Non-Trivial

This isn't a simple CRUD app with an AI wrapper. Key technical challenges addressed:

- **Asynchronous AI Processing**: AI analysis runs in a separate worker process via BullMQ, not in the request/response cycle
- **RAG Advisory System**: Complete retrieval-augmented generation pipeline with vector embeddings, semantic search, and document chunking
- **Vector Database Integration**: PostgreSQL with pgvector extension for efficient similarity search over 1536-dimensional embeddings
- **Real-Time Updates**: WebSocket integration with Redis Pub/Sub for live status updates across distributed processes
- **Failure Handling**: Explicit FAILED state with retry/re-analyze functionality and multiple analysis runs per decision
- **Provider Abstraction**: Swappable AI providers (mock for development, Groq for production) with structured JSON output
- **Anti-Hallucination Design**: Document-grounded prompting with strict constraints to prevent LLM from inventing facts
- **Denormalized Aggregations**: Dashboard queries optimized with denormalized fields to avoid parsing JSONB in aggregations
- **Server-Side Filtering**: Complex filtering and sorting logic (including custom "needs attention" and "most biases" sorts)
- **Production Observability**: OpenTelemetry traces + metrics exported to Prometheus/Grafana

---

## Implemented Features

### Core Functionality
- ✅ **User Authentication**: Email/password auth with JWT (access + refresh tokens), user-scoped data
- ✅ **Decision CRUD**: Create, read, update, delete decisions with situation context and personal reasoning
- ✅ **Asynchronous AI Analysis**: Background processing via BullMQ + Redis queue
- ✅ **Structured AI Output**: Category classification, cognitive bias detection, missed alternatives, strategic insights

### RAG Advisory System
- ✅ **Decision-Based Advice**: Ask questions and receive advice grounded in past decision patterns
- ✅ **Document-Based Advice**: Upload attachments and ask questions about specific documents
- ✅ **Vector Similarity Search**: pgvector-powered semantic search over decisions and document chunks
- ✅ **Async Embedding Generation**: Background processing of embeddings for decisions and attachments
- ✅ **Document Chunking**: Fixed-size chunking (500 tokens, 100 overlap) for large documents
- ✅ **Anti-Hallucination Prompting**: Strict constraints to ground advice in actual document content

### Advanced Features
- ✅ **Real-Time Status Updates**: WebSocket connection with Socket.IO + Redis adapter for live analysis progress
- ✅ **Multiple Analysis Runs**: Support for re-analyzing decisions with full run history
- ✅ **Retry on Failure**: Explicit FAILED state with retry button for failed analyses
- ✅ **Dashboard with Visualizations**: Bar charts showing decision category frequency and cognitive bias distribution
- ✅ **Server-Side Filtering & Sorting**: Filter by status/category/bias, sort by newest/oldest/needs-attention/most-biases
- ✅ **Dark Mode**: Light/dark/system theme support with SSR-safe implementation (next-themes)

### Technical Features
- ✅ **AI Provider Abstraction**: Pluggable providers (mock for dev, Groq for production)
- ✅ **Embedding Provider Abstraction**: Pluggable embedding providers (mock, OpenAI)
- ✅ **Worker-Only AI Execution**: AI calls isolated to worker process, never in web or API server
- ✅ **Denormalized Fields**: Optimized dashboard queries with `categoryText` and `biasesText` fields
- ✅ **Type-Safe Schema**: Prisma ORM with PostgreSQL + pgvector extension, full TypeScript coverage
- ✅ **Monorepo Structure**: pnpm workspaces with `apps/web`, `apps/api`, and `apps/worker`
- ✅ **Observability**: OpenTelemetry → Prometheus → Grafana with distributed tracing and custom metrics

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Next.js UI  │  │  WebSocket   │  │  HTTP API Requests   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼──────────────────┼───────────────────────┼─────────────┘
          │                  │                       │
          ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js Web Server — apps/web (port 80)            │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  API Routes    │  │  Socket.IO      │  │  Server         │  │
│  │ (thin proxies) │  │  Server         │  │  Components     │  │
│  └────────┬───────┘  └────────┬────────┘  └─────────────────┘  │
└───────────┼──────────────────┼─────────────────────────────────┘
            │ Proxy (JWT)      │ Subscribe to Events (Redis)
            ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│            NestJS API — apps/api (port 4000)                     │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────────┐   │
│  │  auth/   │ │decisions/ │ │attachments/│ │    advice/     │   │
│  │  (JWT)   │ │  (CRUD)   │ │ (upload)   │ │    (RAG)       │   │
│  └──────────┘ └───────────┘ └────────────┘ └────────────────┘   │
│  ┌──────────┐ ┌────────────────────────────────────────────────┐ │
│  │dashboard/│ │  observability/ (OTel traces + metrics)        │ │
│  └──────────┘ └────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────────┘
                         │ Enqueue Jobs / Write DB
            ┌────────────┴────────────┐
            ▼                         ▼
┌─────────────────────┐  ┌────────────────────────────────────────┐
│   Redis (BullMQ)    │  │   PostgreSQL (pgvector/pg15)           │
│   3 queues:         │  │   - Users, Decisions, Attachments      │
│   - decision-       │  │   - DecisionAnalysisRuns               │
│     analysis        │  │   - DecisionEmbeddings                 │
│   - decision-       │  │   - AttachmentChunks + Embeddings      │
│     embedding       │  └────────────────────────────────────────┘
│   - attachment-     │               ▲
│     embedding       │               │ Read/Write
└─────────┬───────────┘               │
          │ Process Jobs              │
          ▼                           │
┌─────────────────────────────────────┴───────────────────────────┐
│                  Worker Process — apps/worker                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  BullMQ Worker (3 concurrent queues)                       │ │
│  │  - decision-analysis  (×5): AI analysis via Groq/mock      │ │
│  │  - decision-embedding (×10): OpenAI/mock embeddings        │ │
│  │  - attachment-embedding (×3): Chunk + embed documents      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                     │ Publish Events                             │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      ▼
          Redis Pub/Sub → Socket.IO → Browser (real-time updates)
```

### Observability Stack

```
apps/api (OTel SDK)
  └─► otel-collector (port 4317/4318)
        ├─► Prometheus (port 9090)   ← metrics scrape
        └─► Grafana   (port 3001)    ← dashboards (admin/admin)
```

### Tech Stack

**Frontend (`apps/web`):**
- Next.js 15 (App Router, custom `server.ts` for Socket.IO)
- React 19
- Tailwind CSS v4
- Socket.IO Client (real-time updates)
- next-themes (dark mode)

**API (`apps/api`):**
- NestJS 10
- JWT authentication (custom — access + refresh tokens, no NextAuth)
- class-validator DTOs with strict whitelist validation
- Prisma ORM 5 + PostgreSQL

**Worker (`apps/worker`):**
- Plain Node.js / TypeScript
- BullMQ (job queue)
- Groq SDK (AI provider)
- OpenAI SDK (embeddings)

**Database:**
- PostgreSQL 15 with pgvector extension
- Prisma ORM (two schemas: `apps/api/prisma/schema.prisma` + `prisma/schema.prisma` for worker)

**Infrastructure:**
- Docker Compose (all services — web, api, worker, postgres, redis, otel-collector, prometheus, grafana)
- pnpm workspaces (monorepo)

**AI/ML:**
- OpenAI Embeddings API (text-embedding-3-small, 1536 dimensions)
- Groq LLM API (llama-3.3-70b-versatile)
- pgvector cosine similarity search

---

## AI Design Decisions

### 1. Asynchronous Processing (Worker-Only)

**Decision:** AI analysis runs exclusively in a separate worker process, never in the web or API server.

**Why:**
- AI calls can take 5-30 seconds (unacceptable for HTTP request/response)
- Prevents web/API server timeouts and poor UX
- Allows horizontal scaling of workers independently
- Enables retry logic without blocking user requests

**Implementation:**
- API server enqueues job to BullMQ → returns immediately
- Worker picks up job → calls AI → updates database
- WebSocket notifies user of completion in real-time

---

### 2. Explicit FAILED State + Retry

**Decision:** Analysis failures are first-class states, not silent errors.

**Why:**
- AI APIs fail (rate limits, timeouts, invalid responses)
- Users need visibility into failures
- Retries should be user-initiated, not automatic (to avoid burning API quota)

**Implementation:**
- `DecisionAnalysisRun.status` enum: `PENDING | PROCESSING | COMPLETED | FAILED`
- Failed runs store error message in database
- UI shows "Retry" button for failed runs
- "Re-analyze" button creates new run for completed analyses

---

### 3. Multiple Analysis Runs

**Decision:** Each decision can have multiple analysis attempts (runs).

**Why:**
- Supports retry on failure
- Allows re-analysis with different prompts or providers
- Maintains history of all attempts

**Implementation:**
- `DecisionAnalysisRun` model (many-to-one with Decision)
- `Decision.latestRunId` points to most recent run for quick UI access

---

### 4. Provider Abstraction

**Decision:** AI and embedding providers are swappable via environment variable.

**Why:**
- Development without API keys (mock provider)
- Easy migration between providers
- Testing without API costs

**Providers:**
- **Mock**: Returns realistic fake data instantly, no API key needed
- **Groq**: Free-tier LLaMA 3.3 70B with structured JSON output
- **OpenAI**: text-embedding-3-small (1536 dimensions)

---

### 5. Structured JSON Output

**Decision:** AI responses are parsed into strict JSON schema, not free-form text.

**Why:**
- Enables programmatic use (filtering, aggregations, visualizations)
- Type-safe frontend rendering
- Supports dashboard analytics

**Schema:**
```typescript
{
  category: "CAREER" | "FINANCIAL" | ...,
  cognitiveBiases: [
    { name: "Confirmation Bias", description: "..." }
  ],
  missedAlternatives: [
    { alternative: "...", reasoning: "..." }
  ],
  insights: {
    strengths: string[],
    weaknesses: string[],
    recommendations: string[]
  }
}
```

---

### 6. Denormalized Fields for Aggregations

**Decision:** Store `categoryText` and `biasesText` as top-level fields on `DecisionAnalysisRun`.

**Why:**
- Dashboard queries need to aggregate by category and bias
- Parsing JSONB in SQL is slow and complex
- Enables efficient filtering

**Trade-off:** Data duplication, but worth it for query performance.

---

## RAG Advisory System

### Overview

The RAG (Retrieval-Augmented Generation) Advisory System enables users to ask questions and receive personalized advice grounded in their past decisions or specific documents.

**Stage 1: Decision Embeddings (Ingestion)**
- Automatically generate vector embeddings for every decision
- Background processing via BullMQ worker
- 1536-dimensional vectors using OpenAI's text-embedding-3-small

**Stage 2: Decision-Based Advice (Retrieval)**
- Ask open-ended questions like "Should I take this job offer?"
- Semantic search over past decisions using pgvector
- Advice grounded in personal decision patterns

**Stage 3: Attachment Embeddings (Ingestion)**
- Upload text documents related to decisions (contracts, reports, etc.)
- Automatic chunking (500 tokens per chunk, 100 token overlap)
- Background embedding generation for each chunk

**Stage 4: Attachment-Based Advice (Retrieval)**
- Ask questions about specific documents
- Semantic search over document chunks
- Document-grounded advice with anti-hallucination constraints

### Key Features

**Vector Similarity Search:**
- PostgreSQL with pgvector extension
- Cosine similarity via `<=>` operator
- User-scoped queries (no data leakage)
- Configurable similarity thresholds (0.70 for decisions, 0.65 for chunks)

**Document Chunking:**
- Fixed-size chunking (500 tokens per chunk, 100 token overlap)
- Cost control (max 50 chunks per attachment)
- Preserves chunk order in retrieval

**Anti-Hallucination Prompting:**
- Strict constraints: "Answer ONLY based on document excerpts"
- Explicit prohibition of inventing facts
- Graceful degradation when context is missing

**Cost Efficiency:**
- ~$0.000002 per decision embedding
- ~$0.00005 per attachment (5 chunks)
- ~$0.00014 per advisory query
- **Total: ~$2.81/month for 100 active users**

### API Examples

**Decision-Based Advice:**
```bash
POST /api/advice
Authorization: Bearer <token>
{
  "question": "Should I take this new job offer?"
}
```

**Attachment-Based Advice:**
```bash
POST /api/advice
Authorization: Bearer <token>
{
  "question": "What should I know about the salary in this contract?",
  "relatedAttachmentId": "clxxx..."
}
```

---

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker & Docker Compose

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd AI-Powered-Decision-Journal
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env — see Environment Variables section below
   ```

4. **Start all services (Docker Compose)**
   ```bash
   docker-compose up -d --build
   ```

   This starts: PostgreSQL, Redis, NestJS API, Next.js web, worker, otel-collector, Prometheus, Grafana.

5. **Open the app**
   ```
   http://localhost:80       # Web UI
   http://localhost:4000     # NestJS API
   http://localhost:3001     # Grafana (admin/admin)
   http://localhost:9090     # Prometheus
   ```

### Common Docker Commands

```bash
docker-compose up -d           # Start all services (detached)
docker-compose up -d --build   # Rebuild images after code changes
docker-compose down            # Stop all services
docker-compose logs -f api     # Tail logs (api | worker | web)
```

### Running Tests (without Docker)

```bash
# API unit tests
cd apps/api && pnpm test

# API integration tests (Testcontainers — real Postgres + Redis)
cd apps/api && pnpm test:integration

# Worker tests
cd apps/worker && pnpm test

# Web unit tests
cd apps/web && pnpm test

# Web E2E (Playwright)
cd apps/web && pnpm test:e2e
```

### Database Migrations

```bash
cd apps/api && pnpm exec prisma migrate dev   # Create + apply migration (dev)
pnpm db:migrate                               # Deploy migrations (production)
pnpm db:generate                              # Regenerate Prisma client
```

> **Note:** There are two Prisma schemas: `apps/api/prisma/schema.prisma` (used by the API) and `prisma/schema.prisma` (used by the worker). Keep both in sync when making schema changes.

---

## Environment Variables

`.env` lives at the repository root. All services load it from there (web and worker via relative path `../../.env`).

```bash
# Database
DATABASE_URL=postgresql://app:app@localhost:5432/app

# Redis
REDIS_URL=redis://localhost:6379

# AI Providers
AI_PROVIDER=mock              # mock (no key needed) | groq
GROQ_API_KEY=                 # required if AI_PROVIDER=groq
EMBEDDING_PROVIDER=mock       # mock (no key needed) | openai
OPENAI_API_KEY=               # required if EMBEDDING_PROVIDER=openai

# Service URLs (overridden in Docker to use container names)
API_URL=http://localhost:4000  # web → NestJS
WEB_URL=http://localhost:3000  # NestJS CORS origin
```

---

## Deployment

### Architecture

| Service | Platform | Notes |
|---|---|---|
| `apps/web` | Vercel or any Node.js host | Custom server.ts — not a standard Next.js deploy |
| `apps/api` | Railway, Render, Fly.io | Long-running NestJS process |
| `apps/worker` | Railway, Render, Fly.io | Long-running Node.js process |
| PostgreSQL | Neon, Supabase, Railway | Must have pgvector extension |
| Redis | Upstash, Redis Cloud | TLS-enabled for production |

### Production Environment Variables

```bash
DATABASE_URL=<postgres-connection-string>
REDIS_URL=<redis-connection-string>
API_URL=<nestjs-api-url>
WEB_URL=<web-app-url>
AI_PROVIDER=groq
GROQ_API_KEY=<your-api-key>
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=<your-api-key>
```

### Build Commands

```bash
# API
cd apps/api && pnpm build

# Worker
cd apps/worker && pnpm build

# Web
cd apps/web && pnpm build
```

### Start Commands

```bash
cd apps/api && pnpm start:prod
cd apps/worker && pnpm start
cd apps/web && pnpm start
```

---

## Known Limitations & Trade-Offs

### 1. No Pagination
**Current:** All decisions loaded at once on `/decisions` page.
**Impact:** Fine for < 100 decisions per user, may slow down with 1000+.
**Future:** Add cursor-based pagination.

### 2. In-Memory Sorting for Complex Cases
**Current:** "Needs attention" and "most biases" sorts happen in-memory after database fetch.
**Impact:** Acceptable for user-scoped data (< 100 decisions).
**Future:** Use raw SQL with custom ORDER BY expressions.

### 3. Single Redis Instance
**Current:** Redis used for both BullMQ queue and Socket.IO pub/sub.
**Impact:** Single point of failure, no high availability.
**Future:** Separate instances for queue vs pub/sub, or Redis Cluster.

### 4. No Rate Limiting
**Current:** No rate limiting on API routes or job enqueuing.
**Impact:** User could spam decision creation and exhaust API quota.
**Future:** Add rate limiting middleware (e.g., NestJS throttler).

### 5. Basic Error Handling
**Current:** Failed jobs store error message but don't distinguish error types.
**Impact:** User sees a generic error message.
**Future:** Add error categorization and user-friendly messages.

### 6. No Vector Index
**Current:** Cosine similarity queries use sequential scan.
**Impact:** Performance degrades linearly with number of embeddings.
**Future:** Add `IVFFlat` index on embedding columns in Prisma migration.

---

### Key Talking Points

**1. Architecture Decisions**
- "I separated the AI processing into a worker to avoid blocking HTTP requests. AI calls can take 30+ seconds, which would timeout any HTTP request."
- "I added a dedicated NestJS API layer so all business logic, auth, and validation live in one place — the Next.js frontend is purely a thin proxy and UI."
- "I used Redis Pub/Sub to bridge the worker and web server for real-time updates without polling."
- "I implemented full OpenTelemetry observability: distributed traces across the API and exported metrics to Prometheus/Grafana."

**2. RAG System Design**
- "I built a 4-stage RAG system: decision embeddings, decision-based advice, attachment chunking, and document-based advice."
- "I used pgvector for semantic search because it's production-ready, cost-effective, and integrates seamlessly with PostgreSQL."
- "I implemented anti-hallucination prompting with strict constraints to prevent the LLM from inventing facts not in the document."
- "I use different similarity thresholds for decisions (0.70) vs chunks (0.65) because chunks are smaller and more granular."

**3. Failure Handling**
- "I made failures explicit with a FAILED state and retry button because AI APIs are unreliable. Silent failures would be terrible UX."
- "I support multiple analysis runs per decision so users can retry without losing history."

**4. Performance Optimizations**
- "I denormalized category and bias data to avoid parsing JSONB in aggregation queries. This makes dashboard queries simpler and faster."
- "Worker queues have tuned concurrency: 5 for analysis (CPU/API bound), 10 for embeddings (IO bound), 3 for attachment processing."

**5. Real-World Constraints**
- "I built mock providers for both LLM and embeddings so the app works without any API keys in development."
- "I designed the worker to be horizontally scalable — you can run multiple instances processing the same BullMQ queues."

**6. Trade-Offs**
- "I chose fixed-size chunking over semantic chunking because it's simpler, more predictable, and good enough for most documents."
- "I scope retrieval to a single attachment at a time for simplicity, but the architecture supports hybrid retrieval in the future."

### Questions You Might Get

**Q: Why a separate NestJS API instead of Next.js API routes?**
A: Next.js API routes are designed for lightweight BFF logic. Having all business logic, auth guards, validation, and DB access in NestJS gives better separation of concerns, testability (unit + integration tests with Testcontainers), and a clear server-side architecture. The Next.js layer stays as a pure UI host.

**Q: Why not use serverless functions for the worker?**
A: AI calls take 5-30 seconds, which exceeds most serverless timeouts. A long-running worker process with BullMQ also gives us retry logic, job prioritization, and horizontal scaling.

**Q: Why pgvector instead of Pinecone or Weaviate?**
A: pgvector keeps everything in PostgreSQL, eliminating a separate vector database. It's simpler, cheaper, and performs well for user-scoped queries (< 10K embeddings per user). For multi-tenant scale, I'd consider dedicated vector DBs.

**Q: How do you prevent hallucination in document-based advice?**
A: Strict prompting constraints: "Answer ONLY based on provided excerpts," "Do NOT invent facts," and "Say so if information is missing." Similarity scores are also included in the response for transparency.

**Q: Why WebSockets instead of polling?**
A: Polling creates unnecessary load and has 1-5 second delay. WebSockets give instant updates with minimal overhead, and the Redis adapter makes it work across multiple web server instances.

**Q: How would you scale this to 10,000 concurrent users?**
A: Horizontally scale workers (multiple instances on same BullMQ queue), use Redis Cluster for HA, add DB read replicas, implement rate limiting, add pagination, and consider sharding embeddings by userId for vector queries.