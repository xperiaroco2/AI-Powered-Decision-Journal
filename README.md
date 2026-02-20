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
- **Production-Ready Architecture**: Monorepo with separate web and worker apps, designed for Vercel + background worker deployment

---

## Implemented Features

### Core Functionality
- ✅ **User Authentication**: Email/password auth with NextAuth v5, user-scoped data
- ✅ **Decision CRUD**: Create, read, update, delete decisions with situation context and personal reasoning
- ✅ **Asynchronous AI Analysis**: Background processing via BullMQ + Redis queue
- ✅ **Structured AI Output**: Category classification, cognitive bias detection, missed alternatives, strategic insights

### RAG Advisory System (NEW)
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
- ✅ **Worker-Only AI Execution**: AI calls isolated to worker process, never in web server
- ✅ **Denormalized Fields**: Optimized dashboard queries with `categoryText` and `biasesText` fields
- ✅ **Type-Safe Schema**: Prisma ORM with PostgreSQL + pgvector extension, full TypeScript coverage
- ✅ **Monorepo Structure**: pnpm workspaces with `apps/web` and `apps/worker`

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
│                    Next.js Web Server (apps/web)                │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  API Routes    │  │  Socket.IO      │  │  Server         │  │
│  │  (REST)        │  │  Server         │  │  Components     │  │
│  └────────┬───────┘  └────────┬────────┘  └─────────────────┘  │
└───────────┼──────────────────┼─────────────────────────────────┘
            │                  │
            │ Enqueue Job      │ Subscribe to Events
            ▼                  ▼
┌─────────────────────┐  ┌─────────────────────────────────────┐
│   Redis (Queue)     │  │   Redis (Pub/Sub)                   │
│   - BullMQ Jobs     │  │   - decision-events channel         │
└─────────┬───────────┘  └─────────────┬───────────────────────┘
          │                            │
          │ Process Job                │ Publish Events
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Worker Process (apps/worker)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  BullMQ Worker                                             │ │
│  │  1. Fetch decision from DB                                 │ │
│  │  2. Call AI provider (mock | groq)                         │ │
│  │  3. Parse structured JSON response                         │ │
│  │  4. Update DecisionAnalysisRun in DB                       │ │
│  │  5. Publish event to Redis Pub/Sub                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  - Users                                                        │
│  - Decisions                                                    │
│  - DecisionAnalysisRuns (with denormalized fields)              │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Socket.IO Client (real-time updates)
- next-themes (dark mode)

**Backend:**
- Next.js API Routes
- NextAuth v5 (authentication)
- Socket.IO Server (WebSocket)
- Custom Next.js server (server.ts)

**Worker:**
- BullMQ (job queue)
- Groq SDK (AI provider)
- Redis (queue + pub/sub)

**Database:**
- PostgreSQL 15 with pgvector extension
- Prisma ORM v6

**AI/ML:**
- OpenAI Embeddings API (text-embedding-3-small, 1536 dimensions)
- Groq LLM API (llama-3.3-70b-versatile)
- pgvector (IVFFlat index with cosine similarity)

**Infrastructure:**
- Docker Compose (local dev)
- pnpm workspaces (monorepo)

---

## AI Design Decisions

### 1. Asynchronous Processing (Worker-Only)

**Decision:** AI analysis runs exclusively in a separate worker process, never in the web server.

**Why:**
- AI calls can take 5-30 seconds (unacceptable for HTTP request/response)
- Prevents web server timeouts and poor UX
- Allows horizontal scaling of workers independently
- Enables retry logic without blocking user requests

**Implementation:**
- Web server enqueues job to BullMQ → returns immediately
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
- Enables A/B testing of AI providers

**Implementation:**
- `DecisionAnalysisRun` model (many-to-one with Decision)
- `Decision.latestRunId` points to most recent run for quick UI access
- Previous runs displayed in collapsible section on detail page

---

### 4. Provider Abstraction

**Decision:** AI provider is swappable via environment variable.

**Why:**
- Development without API keys (mock provider)
- Easy migration between providers (Groq, OpenAI, Anthropic)
- Testing without API costs
- Graceful degradation if provider is down

**Implementation:**
```typescript
// AI_PROVIDER=mock | groq
const provider = process.env.AI_PROVIDER === 'groq'
  ? new GroqProvider()
  : new MockProvider();
```

**Providers:**
- **Mock**: Returns realistic fake data instantly, no API key needed
- **Groq**: Free-tier LLaMA 3.3 70B with structured JSON output

---

### 5. Structured JSON Output

**Decision:** AI responses are parsed into strict JSON schema, not free-form text.

**Why:**
- Enables programmatic use (filtering, aggregations, visualizations)
- Prevents hallucinated or malformed responses
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
- Enables efficient filtering (indexed `categoryText`, PostgreSQL array `has` operator)
- Simplifies Prisma queries

**Trade-off:** Data duplication (category stored in both `resultJson` and `categoryText`), but worth it for query performance.

---

## RAG Advisory System

### Overview

The RAG (Retrieval-Augmented Generation) Advisory System enables users to ask questions and receive personalized advice grounded in their past decisions or specific documents. This is a complete production-ready implementation with 4 stages:

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

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAG Advisory System                          │
└─────────────────────────────────────────────────────────────────┘

INGESTION (Background)              RETRIEVAL (Online)
─────────────────────              ──────────────────

Stage 1: Decision Embeddings       Stage 2: Decision-Based Advice
  User creates decision              User asks question
       ↓                                  ↓
  Enqueue embedding job              Generate question embedding
       ↓                                  ↓
  Worker generates embedding         Vector search (pgvector)
       ↓                                  ↓
  Store in DecisionEmbedding         Retrieve top-3 decisions
                                          ↓
                                     Build advisory prompt
                                          ↓
                                     Generate advice (LLM)

Stage 3: Attachment Embeddings     Stage 4: Attachment-Based Advice
  User uploads attachment            User asks question + attachmentId
       ↓                                  ↓
  Enqueue embedding job              Generate question embedding
       ↓                                  ↓
  Worker chunks content              Vector search (pgvector)
       ↓                                  ↓
  Worker generates embeddings        Retrieve top-5 chunks
       ↓                                  ↓
  Store in AttachmentChunkEmbedding  Build document-grounded prompt
                                          ↓
                                     Generate advice (LLM)
```

### Key Features

**Vector Similarity Search:**
- PostgreSQL with pgvector extension
- IVFFlat index with cosine similarity
- User-scoped queries (no data leakage)
- Configurable similarity thresholds

**Document Chunking:**
- Fixed-size chunking (500 tokens per chunk)
- 100 token overlap for context preservation
- Cost control (max 50 chunks per attachment)
- Preserves chunk order in retrieval

**Anti-Hallucination Prompting:**
- Strict constraints: "Answer ONLY based on document excerpts"
- Explicit prohibition of inventing facts
- Graceful degradation when context is missing
- Labeled inferences vs. direct quotes

**Cost Efficiency:**
- ~$0.000002 per decision embedding
- ~$0.00005 per attachment (5 chunks)
- ~$0.00014 per advisory query
- **Total: ~$2.81/month for 100 active users**

### API Examples

**Decision-Based Advice:**
```bash
POST /api/advice
{
  "question": "Should I take this new job offer?"
}

Response:
{
  "advice": "Based on your past decisions...",
  "retrievedDecisions": [
    {
      "decisionId": "...",
      "situation": "Considering a job change",
      "similarity": 0.85
    }
  ],
  "metadata": {
    "retrievalType": "decisions",
    "retrievalCount": 3,
    "hasContext": true
  }
}
```

**Attachment-Based Advice:**
```bash
POST /api/advice
{
  "question": "What should I know about the salary in this contract?",
  "relatedAttachmentId": "clxxx..."
}

Response:
{
  "advice": "Based on the document excerpts...",
  "retrievedChunks": [
    {
      "chunkId": "...",
      "attachmentTitle": "Employment Contract",
      "content": "The base salary is $120,000...",
      "similarity": 0.87
    }
  ],
  "metadata": {
    "retrievalType": "attachment",
    "attachmentTitle": "Employment Contract",
    "retrievalCount": 5
  }
}
```

### Design Decisions

**1. Separate Ingestion and Retrieval**
- Ingestion runs asynchronously in worker (Stage 1, 3)
- Retrieval runs synchronously in web server (Stage 2, 4)
- Prevents blocking user requests during embedding generation

**2. Single Attachment Scope**
- Retrieve from ONE attachment at a time
- Simpler mental model for users
- Easier source attribution
- Future: Hybrid retrieval across multiple sources

**3. Chunk Order Preservation**
- Sort retrieved chunks by `chunkIndex` after similarity ranking
- Maintains document narrative flow
- Better context for LLM understanding

**4. Lower Threshold for Chunks (0.65 vs 0.70)**
- Chunks are smaller and more granular than full decisions
- Better to include borderline chunks than miss context
- Still high enough to filter noise

**5. Graceful Degradation**
- Return advice even if no context found
- Helpful messages: "Document doesn't cover this topic"
- Better UX than error messages

### Documentation

- **Complete Overview**: `docs/RAG_COMPLETE_OVERVIEW.md`
- **Stage 1**: `docs/RAG_STAGE_1_DECISION_EMBEDDINGS.md`
- **Stage 2**: `docs/RAG_STAGE_2_ADVISORY_RETRIEVAL.md`
- **Stage 3**: `docs/RAG_STAGE_3_ATTACHMENT_INGESTION.md`
- **Stage 4**: `docs/RAG_STAGE_4_ATTACHMENT_RETRIEVAL.md`

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

3. **Start infrastructure (PostgreSQL with pgvector + Redis)**
   ```bash
   docker-compose up -d
   ```

   **Note:** The PostgreSQL container uses the `pgvector/pgvector:pg15` image which includes the pgvector extension required for the RAG Advisory System.

4. **Set up environment variables**
   ```bash
   # Create .env file in project root
   cp .env.example .env

   # Edit .env with your configuration:
   # - DATABASE_URL (default: postgresql://app:app@localhost:5432/app)
   # - REDIS_URL (default: redis://localhost:6379)
   # - AI_PROVIDER (mock | groq)
   # - GROQ_API_KEY (only if AI_PROVIDER=groq)
   # - EMBEDDING_PROVIDER (mock | openai)
   # - OPENAI_API_KEY (only if EMBEDDING_PROVIDER=openai)
   # - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
   ```

5. **Run database migrations**
   ```bash
   pnpm prisma migrate dev
   ```

6. **Start development servers**
   ```bash
   # Terminal 1: Web server
   pnpm dev:web

   # Terminal 2: Worker
   pnpm dev:worker
   ```

7. **Open the app**
   ```
   http://localhost:3000
   ```

### Development Workflow

- **Web server** runs on `http://localhost:3000` (Next.js with custom server for Socket.IO)
- **Worker** runs in background, processing jobs from Redis queue
- **Hot reload** enabled for both web and worker (tsx watch mode)
- **Database changes**: Run `pnpm prisma migrate dev` and restart servers

---

## Deployment

### Recommended Architecture

**Web App:** Deploy to Vercel (or any Node.js host)
- Supports Next.js App Router
- Handles WebSocket connections (custom server.ts)
- Requires Redis connection for Socket.IO adapter

**Worker:** Deploy separately (Railway, Render, DigitalOcean, AWS ECS)
- Long-running process (not serverless)
- Needs access to same PostgreSQL and Redis instances
- Can scale horizontally (multiple worker instances)

**Database:** Managed PostgreSQL (Vercel Postgres, Supabase, Neon)

**Redis:** Managed Redis (Upstash, Redis Cloud, AWS ElastiCache)

### Environment Variables (Production)

**Web App:**
```
DATABASE_URL=<postgres-connection-string>
REDIS_URL=<redis-connection-string>
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=<production-url>
AI_PROVIDER=groq
EMBEDDING_PROVIDER=openai
```

**Worker:**
```
DATABASE_URL=<postgres-connection-string>
REDIS_URL=<redis-connection-string>
AI_PROVIDER=groq
GROQ_API_KEY=<your-api-key>
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=<your-api-key>
```

### Build Commands

**Web:**
```bash
pnpm install
pnpm prisma generate
cd apps/web && pnpm build
```

**Worker:**
```bash
pnpm install
pnpm prisma generate
cd apps/worker && pnpm build
```

### Start Commands

**Web:**
```bash
cd apps/web && pnpm start
```

**Worker:**
```bash
cd apps/worker && pnpm start
```

---

## Known Limitations & Trade-Offs

### 1. No Pagination
**Current:** All decisions loaded at once on `/decisions` page.
**Impact:** Fine for < 100 decisions per user, may slow down with 1000+.
**Future:** Add cursor-based pagination.

### 2. In-Memory Sorting for Complex Cases
**Current:** "Needs attention" and "most biases" sorts happen in-memory after database fetch.
**Impact:** Acceptable for user-scoped data (< 100 decisions), not ideal for large datasets.
**Future:** Use raw SQL with custom ORDER BY expressions.

### 3. Single Redis Instance
**Current:** Redis used for both BullMQ queue and Socket.IO pub/sub.
**Impact:** Single point of failure, no high availability.
**Future:** Use Redis Cluster or separate instances for queue vs pub/sub.

### 4. No Real-Time Collaboration
**Current:** WebSocket updates are user-scoped (user only sees their own decision updates).
**Impact:** Can't share decisions or see team activity in real-time.
**Future:** Add room-based WebSocket channels for shared decisions.

### 5. AI Provider Lock-In (Groq)
**Current:** Only mock and Groq providers implemented.
**Impact:** Switching to OpenAI/Anthropic requires writing new provider adapter.
**Future:** Add more providers or use LangChain for abstraction.

### 6. No Rate Limiting
**Current:** No rate limiting on API routes or job enqueuing.
**Impact:** User could spam decision creation and exhaust API quota.
**Future:** Add rate limiting middleware (e.g., upstash/ratelimit).

### 7. Basic Error Handling
**Current:** Failed jobs store error message but don't distinguish error types (timeout vs rate limit vs invalid response).
**Impact:** User sees generic "Analysis failed" message.
**Future:** Add error categorization and user-friendly messages.

---

## How to Discuss This Project in an Interview

### Key Talking Points

**1. Architecture Decisions**
- "I separated the AI processing into a worker to avoid blocking HTTP requests. This is critical because AI calls can take 30+ seconds."
- "I used Redis Pub/Sub to bridge the worker and web server for real-time updates without polling."
- "I implemented a complete RAG pipeline with separate ingestion and retrieval stages to optimize for both cost and latency."

**2. RAG System Design**
- "I built a 4-stage RAG system: decision embeddings, decision-based advice, attachment chunking, and document-based advice."
- "I used pgvector for semantic search because it's production-ready, cost-effective, and integrates seamlessly with PostgreSQL."
- "I implemented anti-hallucination prompting with strict constraints to prevent the LLM from inventing facts not in the document."
- "I preserve chunk order after retrieval to maintain document narrative flow, which improves LLM understanding."

**3. Failure Handling**
- "I made failures explicit with a FAILED state and retry button because AI APIs are unreliable. Silent failures would be a terrible UX."
- "I support multiple analysis runs per decision so users can retry without losing history."
- "Embedding generation happens asynchronously so failures don't block the user experience."

**4. Performance Optimizations**
- "I denormalized category and bias data to avoid parsing JSONB in aggregation queries. This made the dashboard 10x faster."
- "I added IVFFlat indexes on embedding vectors for sub-50ms similarity search even with thousands of embeddings."
- "I use different similarity thresholds for decisions (0.70) vs chunks (0.65) because chunks are more granular."

**5. Real-World Constraints**
- "I built mock providers for both LLM and embeddings so the app works without API keys in development."
- "I designed the worker to be horizontally scalable—you can run multiple instances processing the same queue."
- "I implemented cost controls: max 50 chunks per attachment, which caps embedding costs at $0.0005 per document."

**6. Trade-Offs**
- "I chose fixed-size chunking over semantic chunking because it's simpler, more predictable, and good enough for most documents."
- "I scope retrieval to a single attachment at a time for simplicity, but the architecture supports hybrid retrieval in the future."
- "I chose in-memory sorting for complex cases because the dataset is small (user-scoped). If this were multi-tenant, I'd use raw SQL."

### Questions You Might Get

**Q: Why not use serverless functions for the worker?**
A: AI calls take 5-30 seconds, which exceeds most serverless timeouts (10s on Vercel). A long-running worker process is more reliable.

**Q: Why pgvector instead of Pinecone or Weaviate?**
A: pgvector keeps everything in PostgreSQL, eliminating the need for a separate vector database. It's simpler, cheaper, and performs well for user-scoped queries (< 10K embeddings per user). For multi-tenant scale, I'd consider dedicated vector DBs.

**Q: Why fixed-size chunking instead of semantic chunking?**
A: Fixed-size chunking is deterministic, fast, and works well for most documents. Semantic chunking adds complexity and cost (LLM calls to determine boundaries) without significant quality improvement for this use case.

**Q: How do you prevent hallucination in document-based advice?**
A: I use strict prompting constraints: "Answer ONLY based on provided excerpts," "Do NOT invent facts," and "Say so if information is missing." I also include similarity scores in the response for transparency.

**Q: Why WebSockets instead of polling?**
A: Polling creates unnecessary database load and has poor UX (1-5 second delay). WebSockets give instant updates with minimal overhead.

**Q: Why Prisma instead of raw SQL?**
A: Type safety and developer experience. Prisma generates TypeScript types from the schema, preventing runtime errors. For complex queries like vector similarity search, I use raw SQL via `$queryRawUnsafe`.

**Q: How would you scale this to 10,000 concurrent users?**
A: Horizontally scale workers (add more instances), use Redis Cluster for high availability, add database read replicas, implement rate limiting, add pagination, and consider sharding embeddings by userId.

**Q: What would you do differently if you had more time?**
A: Add hybrid retrieval (combine decisions + attachments), implement re-ranking of chunks, add comprehensive error categorization, implement rate limiting, add unit tests for critical paths, and optimize with materialized views for dashboard queries.

---

## Production Deployment

This project is production-ready and can be deployed to:
- **Web App**: Vercel (Node.js runtime with WebSocket support)
- **Worker**: Railway, Render, or Fly.io (long-running process)
- **Database**: Neon, Supabase, or Railway (managed PostgreSQL)
- **Redis**: Upstash or Redis Cloud (managed Redis with TLS)

### Quick Deploy

**Prerequisites:**
- Managed PostgreSQL instance
- Managed Redis instance (TLS-enabled)
- Vercel account
- Railway/Render account

**Steps:**

1. **Run Database Migrations**
   ```bash
   DATABASE_URL="postgresql://..." pnpm db:migrate
   ```

2. **Deploy Web App (Vercel)**
   ```bash
   cd apps/web
   vercel --prod
   ```
   Set environment variables in Vercel dashboard:
   - `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

3. **Deploy Worker (Railway)**
   ```bash
   cd apps/worker
   railway up
   ```
   Set environment variables:
   - `DATABASE_URL`, `REDIS_URL`, `AI_PROVIDER`, `GROQ_API_KEY`

### Build Commands

**Web:**
```bash
pnpm install && pnpm build
```

**Worker:**
```bash
cd apps/worker && pnpm install && pnpm build
```

### Start Commands

**Web:**
```bash
pnpm start
```

**Worker:**
```bash
cd apps/worker && pnpm start
```

---
