# Observability Explained

A practical guide to how tracing, metrics, and logging work in this project.
Written for a backend developer who is new to observability concepts.

---

## What is observability and why does it matter?

Observability is the ability to understand what your system is doing from the
outside — by looking at the data it produces. It answers questions like:

- Why did this request take 3 seconds?
- Which step in the AI pipeline is the slowest?
- How many login failures happened in the last hour?
- Did the worker crash silently, or did the job just not arrive?

In this project, observability is built on three pillars:

| Pillar | What it records | Tool used |
|---|---|---|
| **Traces** | The journey of a single request across services | OpenTelemetry |
| **Metrics** | Counts and durations aggregated over time | OpenTelemetry + prom-client |
| **Logs** | Human-readable structured events | pino |

---

## The big picture: data flow

```
Browser
  │
  ▼
apps/web  (Next.js)
  │  no observability instrumentation
  │
  ▼
apps/api  (NestJS, port 4000)
  │
  ├─ Traces ──────────────────────────────────► otel-collector:4318 (OTLP/HTTP)
  ├─ Metrics ─────────────────────────────────► otel-collector:4318 (OTLP/HTTP)
  └─ Logs ─────────────────────────────────────► stdout (container logs)
  │
  │  enqueues jobs via BullMQ (Redis)
  │  injects W3C traceparent into job data
  │
  ▼
apps/worker  (plain Node.js)
  │
  ├─ Traces ──────────────────────────────────► otel-collector:4318 (OTLP/HTTP)
  ├─ OTel Metrics ────────────────────────────► otel-collector:4318 (OTLP/HTTP)
  ├─ prom-client Metrics ──────────────────────► HTTP :9465  ◄── Prometheus scrapes this
  └─ Logs ─────────────────────────────────────► stdout
  │
  ▼
otel-collector  (port 4318 in, 9464 out)
  │
  ├─ Traces ──────────────────────────────────► debug exporter (stdout only, in dev)
  └─ Metrics ──────────────────────────────────► prometheus exporter :9464
  │
  ▼
Prometheus  (port 9090)
  │  scrapes otel-collector:9464 every 15 s  (API + worker OTel metrics)
  │  scrapes worker:9465 every 15 s           (worker prom-client metrics)
  │  stores time-series data for 7 days
  │
  ▼
Grafana  (port 3001)
  queries Prometheus → renders dashboards
  auto-provisioned: Prometheus datasource + golden-signals dashboard
  default login: admin / admin
```

---

## Part 1: Traces

### What is a trace?

A trace records the complete journey of a single operation through your
system. It is made up of **spans** — individual units of work, each with
a name, start time, duration, and optional attributes.

Example: a user submits a decision. The trace might look like:

```
POST /decisions  (HTTP span, auto-created by Express instrumentation)
└─ decisions.create  (service span)
   ├─ prisma.query  (DB insert, auto-created by Prisma instrumentation)
   ├─ queue.enqueue  (explicit span in QueueService)
   └─ queue.enqueue  (explicit span for embedding queue)
```

All spans share the same `trace_id`. You can search by it in any trace viewer.

### How is the OTel SDK started?

Both the API and the worker start the SDK **before** anything else loads.
This is critical — the SDK patches Node.js built-in modules (http, net) and
third-party libraries (ioredis, Prisma) at require-time. If you load those
modules first, they won't be instrumented.

**API** (`apps/api/src/main.ts`, line 2):
```ts
import './otel';  // ← must be the very first import
import { NestFactory } from '@nestjs/core';
// ...
```

**Worker** (`apps/worker/src/index.ts`, line 9):
```ts
// dotenv loaded first (so OTEL_* env vars are available if set via .env)
import { shutdownOtel } from "./otel";
// ← OTel starts as a side-effect of the import
```

The SDK configuration lives in:
- `apps/api/src/otel.ts`
- `apps/worker/src/otel.ts`

Both files configure the same three things:

1. **A resource** — metadata attached to every span. Tells the collector that
   spans came from `service.name=api` or `service.name=worker`, which
   environment (`deployment.environment=local`), and what version.

2. **A trace exporter** — sends spans over OTLP/HTTP to
   `http://otel-collector:4318/v1/traces`. In Docker, this is the collector
   container. Locally, you'd need to point it at `localhost:4318`.

3. **Auto-instrumentations** — libraries that automatically create spans for
   common operations without you writing any code:
   - `@opentelemetry/instrumentation-http` — every HTTP request in/out
   - `@opentelemetry/instrumentation-express` — Express route handler spans
   - `@opentelemetry/instrumentation-ioredis` — every Redis command
   - `@prisma/instrumentation` — every Prisma query, with SQL preview
   - `@opentelemetry/instrumentation-fs` is **disabled** (too noisy — every
     file read would generate a span)

### Manual spans (custom instrumentation)

Auto-instrumentation gives you the skeleton. Manual spans add business context.

The pattern used throughout this project:

```ts
const tracer = trace.getTracer('api');  // or 'worker'

await tracer.startActiveSpan(
  'advisory.embed-question',            // span name
  { attributes: {                       // initial attributes
    'advisory.type': 'decision',
    'question.length': request.question.length,
  }},
  async (span) => {
    try {
      const result = await doWork();
      span.setAttribute('result.count', result.length);  // add more attributes
      return result;
    } catch (err) {
      span.recordException(err);         // attach error details to span
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();                        // always end the span
    }
  }
);
```

**Where manual spans are used in this project:**

| File | Span name | What it covers |
|---|---|---|
| `apps/api/src/queue/queue.service.ts` | `queue.enqueue` | Time to write a job to Redis |
| `apps/api/src/advice/services/advisory.service.ts` | `advisory.embed-question` | Embedding the user's question |
| `apps/api/src/advice/services/advisory.service.ts` | `advisory.vector-search` | pgvector similarity search |
| `apps/api/src/advice/services/advisory.service.ts` | `advisory.llm-generate` | Calling the LLM |
| `apps/worker/src/processors/decision-analysis.processor.ts` | `worker.decision-analysis` | Entire analysis job |
| `apps/worker/src/processors/decision-analysis.processor.ts` | `worker.ai-provider.analyze` | AI provider call (Groq or mock) |
| `apps/worker/src/processors/decision-embedding.processor.ts` | `worker.decision-embedding` | Entire embedding job |
| `apps/worker/src/processors/decision-embedding.processor.ts` | `worker.embedding.generate` | Single OpenAI embedding API call |
| `apps/worker/src/processors/attachment-embedding.processor.ts` | `worker.attachment-embedding` | Entire attachment job |
| `apps/worker/src/processors/attachment-embedding.processor.ts` | `worker.embedding.generate-chunks` | Batch: all chunk embeddings |
| `apps/worker/src/services/orchestration/orchestrator.ts` | `orchestration.initial-analysis` | First LLM step |
| `apps/worker/src/services/orchestration/orchestrator.ts` | `orchestration.reflection` | Second LLM step |
| `apps/worker/src/services/orchestration/orchestrator.ts` | `orchestration.final-synthesis` | Third LLM step |

### Distributed traces: API → Worker

When the API enqueues a BullMQ job, the active trace would normally end there.
The worker is a completely separate process, so it has no automatic connection
to the API's trace.

The solution is W3C Trace Context propagation — a standardised way to pass
the current trace ID via a text header (`traceparent`), originally designed for
HTTP but usable in any carrier.

**On the API side** (`apps/api/src/observability/trace-context.helper.ts`):
```ts
// Grabs the current span's traceparent and injects it into the job payload
const jobData = injectTraceContext({ runId });
// Result: { runId: '...', __otel: { traceparent: '00-<traceId>-<spanId>-01' } }
await queue.add('analyze-decision', jobData, { ... });
```

**On the Worker side** (`apps/worker/src/trace-context.helper.ts`):
```ts
// At the top of every processor:
const parentCtx = extractTraceContext(job.data);
// Creates a new span that is a CHILD of the API's span
return context.with(parentCtx, () =>
  tracer.startActiveSpan('worker.decision-analysis', async (span) => {
    // ...
  })
);
```

The result is a single trace that spans both services, letting you see the
complete journey from HTTP request → job enqueue → job processing in one view.

### The span enrichment middleware and interceptor

Two pieces of middleware add context to spans automatically for every request:

**`RequestContextMiddleware`** (`apps/api/src/observability/request-context.middleware.ts`):
- Runs first, before route handlers
- Reads the `X-Request-Id` header (or generates a UUID)
- Attaches `http.request_id` to the active span
- Echoes the ID back in the response header (useful for correlating with client-side logs)

**`TelemetryInterceptor`** (`apps/api/src/observability/telemetry.interceptor.ts`):
- Runs after auth guards
- Adds `enduser.id` to the span (the authenticated user's ID)
- Calls the RED metrics (see metrics section below)
- Marks the span as `ERROR` if the handler throws

### Where do traces go in this project?

Traces go from the API/worker → otel-collector → **debug exporter** (stdout).
This means in development, spans are logged to the collector's container
output but are **not stored in a queryable trace backend**.

To see traces in a UI like Jaeger or Grafana Tempo, you would add an `otlp`
exporter in `docker/otel-collector-config.yaml` pointing at a Tempo or Jaeger
container. The collector config file has a comment explaining exactly this.

---

## Part 2: Metrics

### What is a metric?

A metric is a numerical measurement aggregated over time. Instead of recording
every individual event (which would be a trace), a metric answers questions
like "how many requests per second?" or "what was the 99th percentile latency
over the last 5 minutes?"

### Two metric backends: why both?

This project uses two different metric systems, which feed into the same
Prometheus storage:

| System | Used by | Transport | How Prometheus gets it |
|---|---|---|---|
| OpenTelemetry metrics | API, worker | OTLP push to collector → prometheus exporter :9464 | Prometheus scrapes collector |
| prom-client | Worker only | HTTP pull endpoint :9465 | Prometheus scrapes worker directly |

The worker uses prom-client for its job-level metrics (a common pattern when
only one service needs a simple scrape endpoint). The API uses OTel metrics
exclusively. Both ultimately land in Prometheus and can be queried in Grafana.

### API metrics (OpenTelemetry)

Defined in `apps/api/src/observability/metrics.ts`. Exported via OTLP every
30 seconds to the collector.

**HTTP RED metrics** (Request/Error/Duration — the standard starting point):

| Metric name | Type | Labels | What it counts |
|---|---|---|---|
| `http_requests_total` | Counter | `route`, `method`, `status_code` | Every HTTP request |
| `http_request_duration_seconds` | Histogram | `route`, `method`, `status_code` | Request latency |
| `http_errors_total` | Counter | `route`, `method` | HTTP 5xx errors |

These are recorded in `TelemetryInterceptor` (for normal flows) and
`AllExceptionsFilter` (for thrown exceptions).

**Auth metrics:**

| Metric name | Type | Labels | What it counts |
|---|---|---|---|
| `auth_attempts_total` | Counter | `operation`, `outcome` | Login/register attempts |

`operation` is `login` or `register`. `outcome` is `success` or `failure`.
Recorded in `AuthService`.

**Advisory / RAG pipeline metrics:**

| Metric name | Type | Labels | What it counts |
|---|---|---|---|
| `advisory_requests_total` | Counter | `type`, `status` | Total RAG advisory calls |
| `advisory_stage_duration_seconds` | Histogram | `type`, `stage` | Duration of each RAG stage |

`stage` is `embed_question`, `vector_search`, or `llm_generate`.
This lets you pinpoint which step in the RAG pipeline is slow.

**Queue enqueue metrics:**

| Metric name | Type | Labels | What it counts |
|---|---|---|---|
| `queue_enqueue_total` | Counter | `queue`, `status` | Jobs added to BullMQ |
| `queue_enqueue_duration_seconds` | Histogram | `queue` | Time to write a job to Redis |

**Runtime / saturation gauges:**

| Metric name | Type | What it measures |
|---|---|---|
| `process_event_loop_lag_seconds` | Gauge | Node.js event loop delay (blocking work) |
| `process_heap_used_bytes` | Gauge | V8 heap in use |
| `process_heap_total_bytes` | Gauge | V8 heap allocated |
| `process_rss_bytes` | Gauge | Process resident memory |
| `process_active_handles` | Gauge | Open sockets, timers, etc. |

These are registered in `main.ts` via `registerRuntimeMetrics()` after the
OTel SDK starts.

### Worker metrics (prom-client)

Defined in `apps/worker/src/metrics.ts`. Exposed on HTTP port 9465.

| Metric name | Type | Labels | What it counts |
|---|---|---|---|
| `worker_jobs_total` | Counter | `queue`, `status` | Jobs completed or failed |
| `worker_job_duration_seconds` | Histogram | `queue` | Time to process a job |

Additionally, `collectDefaultMetrics()` automatically adds Node.js runtime
metrics (heap, event loop, GC, etc.) to the same prom-client registry.

**Two sources of job metrics:** Job metrics are recorded in two places:
- **Inside each processor** (by the processor functions themselves) with
  labels `success`, `failed`, `partial`
- **In `index.ts` BullMQ event handlers** (`.on('completed')`, `.on('failed')`)
  with labels `completed`, `failed`

These use different label values so they don't collide — they represent two
complementary views of the same events.

---

## Part 3: Logs

### What is structured logging?

Instead of printing a plain string like `"User 123 logged in"`, structured
logging emits a JSON object: `{"level":"info","userId":"123","msg":"Login"}`.
This makes logs machine-parseable and filterable by field.

### API logging (nestjs-pino)

Configured in `apps/api/src/observability/logger.ts`.

- Uses **pino** (fastest Node.js JSON logger) via the `nestjs-pino` adapter
- In **development** (`NODE_ENV != production`): pretty-printed with colors,
  single-line, human-readable timestamps
- In **production** (Docker): raw JSON to stdout, to be collected by your
  log aggregator (Loki, CloudWatch, etc.)

**Trace correlation:** Every log line automatically includes `trace_id` and
`span_id` from the currently active OTel span. The pino `mixin` function
calls `getTraceIds()` on every log call:

```ts
mixin() {
  return getTraceIds();  // adds { trace_id: '...', span_id: '...' }
}
```

This means you can copy a `trace_id` from a log line and look it up in
your trace viewer to see exactly what the system was doing at that moment.

**Sensitive field redaction:** Passwords, tokens, cookies, and API keys
are automatically replaced with `[REDACTED]` before the log is emitted.
This is configured in the `redact` field of the pino config and happens
before any serialization — the values never appear in log output.

**HTTP log levels:** HTTP response status codes are mapped to log levels
automatically — 5xx → `error`, 4xx → `warn`, 2xx → `info`.

### Worker logging (pino)

Configured in `apps/worker/src/logger.ts`. Simpler than the API — no HTTP
middleware, just a raw pino instance with the same trace correlation mixin.

Each processor and service creates a named child logger:
```ts
const log = childLogger('analysis-processor');
// Every log from this logger includes: { "context": "analysis-processor" }
```

Structured fields are always passed as the first argument:
```ts
log.info({ jobId: job.id, runId }, 'Processing run');
// Output: { "level": 30, "context": "analysis-processor", "jobId": "...", "runId": "...", "msg": "Processing run" }
```

**Convention:** Never use `console.log/warn/error` in application code.
Always use the injected NestJS `Logger` (API) or `childLogger` (worker).

---

## Part 4: The infrastructure components

### The OTel Collector

**Config file:** `docker/otel-collector-config.yaml`

The collector is a standalone process that acts as a central hub for
telemetry data. Applications send data to it; it processes and forwards
the data to backends. This decouples your application from the storage
backend — you can swap out Jaeger for Tempo without touching any application
code.

**How it is configured in this project:**

```
Receivers (data comes IN):
  otlp:
    grpc: 0.0.0.0:4317   ← API/worker can use gRPC if preferred
    http: 0.0.0.0:4318   ← API/worker use this (OTLP/HTTP)

Processors (transform in-flight):
  memory_limiter   → safety valve: drops data if memory spikes above 256 MB
  batch            → groups spans/metrics into batches before export
                     (reduces network overhead; sends every 5s or 1024 items)
  resource         → adds collector.name=otel-collector to all metrics

Exporters (data goes OUT):
  debug            → writes trace summaries to stdout (development view)
  prometheus       → exposes metrics as a Prometheus scrape endpoint :9464

Pipelines (wiring):
  traces  → [otlp] → [memory_limiter, batch] → [debug]
  metrics → [otlp] → [memory_limiter, batch, resource] → [prometheus]
```

The key thing to understand: **traces and metrics go through separate
pipelines**. Traces currently end at the debug exporter (stdout).
Metrics are converted into Prometheus format and served on port 9464.

### Prometheus

**Config file:** `docker/prometheus.yml`

Prometheus is a time-series database designed for metrics. It works by
**scraping** (polling) HTTP endpoints that expose metrics in a plain-text
format. It stores values with timestamps and lets you query them with PromQL.

**What it scrapes every 15 seconds:**

| Job name | Target | What it gets |
|---|---|---|
| `otel-collector` | `otel-collector:9464` | All API metrics (HTTP RED, auth, RAG, queue) |
| `worker` | `worker:9465` | Worker job counts, durations, Node.js runtime |
| `otel-collector-internal` | `otel-collector:8888` | Collector's own health metrics |
| `prometheus` | `localhost:9090` | Prometheus's own metrics |

Data is stored for 7 days (`--storage.tsdb.retention.time=7d`).

You can explore raw metrics at `http://localhost:9090` using PromQL. For
example, to see request rates:
```
rate(http_requests_total[5m])
```

### Grafana

**Provisioning files:** `docker/grafana/provisioning/`

Grafana is a dashboard and visualisation platform. It queries Prometheus
and renders graphs, tables, and alerts.

In this project, Grafana is fully **auto-provisioned** — when the container
starts, it automatically configures itself with no manual steps:

1. **Datasource** (`provisioning/datasources/datasource.yml`): wires up
   Prometheus at `http://prometheus:9090` as the default datasource
2. **Dashboard provider** (`provisioning/dashboards/dashboard.yml`): tells
   Grafana to load dashboards from the `/etc/grafana/provisioning/dashboards`
   directory
3. **Golden signals dashboard** (`provisioning/dashboards/golden-signals.json`):
   a pre-built dashboard showing the four golden signals of reliability:
   latency, traffic, errors, and saturation

Access Grafana at `http://localhost:3001` with `admin` / `admin`.

---

## Part 5: End-to-end example

**User submits a new decision — what happens observability-wise?**

```
1. Browser → POST /api/decisions/
   (Next.js API route, proxied to NestJS — no instrumentation in web)

2. NestJS receives the request
   → Express auto-instrumentation creates an HTTP span
   → RequestContextMiddleware: attaches X-Request-Id to span + response header
   → JwtAuthGuard: validates JWT
   → TelemetryInterceptor: adds enduser.id to span

3. DecisionsService.create() runs
   → Prisma insert → Prisma auto-instrumentation creates DB span (child of HTTP span)
   → QueueService.enqueueAnalysisRun()
     → manual span 'queue.enqueue' opens
     → injectTraceContext() serialises traceparent into job payload
     → BullMQ writes job to Redis → ioredis auto-instrumentation creates Redis span
     → queue_enqueue_total counter incremented
     → span ends

4. TelemetryInterceptor records:
   → http_requests_total{route='/decisions', method='POST', status_code='201'}
   → http_request_duration_seconds

5. Meanwhile: worker picks up the job from Redis
   → extractTraceContext() restores the API's traceparent
   → 'worker.decision-analysis' span opens as a CHILD of the API's span
     → same trace_id — this is now one continuous distributed trace
   → 'worker.ai-provider.analyze' span opens
     → DecisionAnalysisOrchestrator runs 3 LLM steps
       → 'orchestration.initial-analysis' span (retryCount, durationMs captured)
       → 'orchestration.reflection' span
       → 'orchestration.final-synthesis' span
   → Prisma update spans (auto-instrumented)
   → publishRunUpdate() → Redis PUBLISH command span
   → jobsTotal.inc({ queue: 'decision-analysis', status: 'success' })
   → jobDurationSeconds.observe(...)
   → All spans end

6. Spans are buffered and sent to otel-collector every ~5s (batch processor)
   → Traces pipeline: otel-collector logs a summary to stdout
   → Metrics pipeline: http_requests_total, queue_enqueue_total etc. made
     available at otel-collector:9464

7. Prometheus scrapes otel-collector:9464 every 15s
   → stores the metric values as time-series

8. Grafana queries Prometheus
   → golden-signals dashboard shows request rate, latency, errors, saturation
```

---

## Part 6: Important files and their roles

| File | Role |
|---|---|
| `apps/api/src/otel.ts` | Starts OTel SDK for the API. Must be first import in main.ts. |
| `apps/worker/src/otel.ts` | Starts OTel SDK for the worker. |
| `apps/api/src/main.ts` | Bootstrap: imports otel.ts first, then calls registerRuntimeMetrics(). |
| `apps/worker/src/index.ts` | Bootstrap: imports otel.ts, starts metrics server, wires up BullMQ event handlers. |
| `apps/api/src/observability/metrics.ts` | Defines all OTel counters and histograms for the API. |
| `apps/api/src/observability/logger.ts` | Pino config: trace correlation, redaction, pretty/JSON switching. |
| `apps/api/src/observability/telemetry.interceptor.ts` | Records RED metrics and enriches spans on every HTTP request. |
| `apps/api/src/observability/request-context.middleware.ts` | Handles X-Request-Id propagation. |
| `apps/api/src/observability/all-exceptions.filter.ts` | Marks spans as ERROR and increments error counter for unhandled exceptions. |
| `apps/api/src/observability/trace-context.helper.ts` | Injects W3C traceparent into BullMQ job payloads (producer side). |
| `apps/api/src/observability/observability.module.ts` | NestJS module that wires up all the above as global providers. |
| `apps/worker/src/metrics.ts` | Defines prom-client counters and histogram; starts the scrape HTTP server. |
| `apps/worker/src/logger.ts` | Pino instance with trace correlation mixin; childLogger factory. |
| `apps/worker/src/trace-context.helper.ts` | Extracts W3C traceparent from job data (consumer side). |
| `docker/otel-collector-config.yaml` | Collector pipelines: what comes in, how it's processed, where it goes. |
| `docker/prometheus.yml` | Prometheus scrape targets and retention settings. |
| `docker/grafana/provisioning/datasources/datasource.yml` | Auto-wires Prometheus as Grafana's default datasource. |
| `docker/grafana/provisioning/dashboards/dashboard.yml` | Tells Grafana where to load dashboard JSON files from. |
| `docker/grafana/provisioning/dashboards/golden-signals.json` | Pre-built dashboard: latency, traffic, errors, saturation. |
| `docker-compose.yml` | Wires containers together; sets OTEL_* env vars for api and worker. |

---

## Part 7: How to extend this setup safely

### Adding a new metric

1. Open `apps/api/src/observability/metrics.ts` (API) or
   `apps/worker/src/metrics.ts` (worker, prom-client)
2. Create a new instrument using the existing `meter` (API) or a new prom-client
   constructor (worker)
3. Export it and import it wherever you need to record values
4. Follow the existing pattern: increment on success, increment on failure with
   a `status` label

Example for a new API counter:
```ts
// In apps/api/src/observability/metrics.ts
export const myOperationTotal = meter.createCounter('my_operation_total', {
  description: 'Total my_operation calls',
});

// In your service
import { myOperationTotal } from '../observability/metrics';
myOperationTotal.add(1, { status: 'success' });
```

### Adding a new span

1. Import `trace` and `SpanStatusCode` from `@opentelemetry/api`
2. Get a tracer: `const tracer = trace.getTracer('api')` (or `'worker'`)
3. Wrap your code in `tracer.startActiveSpan(...)`, following the try/catch/finally
   pattern used in `advisory.service.ts` or the processors
4. Always call `span.end()` in a `finally` block — an unended span leaks memory

Important: keep span names consistent and descriptive. Prefer `noun.verb`
format (e.g., `advisory.vector-search`, `worker.embedding.generate`).

### Adding a new log field

For the API, inject the `Logger` from `@nestjs/common`:
```ts
private readonly logger = new Logger(MyService.name);
this.logger.log({ userId, decisionId }, 'Decision processed');
```

For the worker, create a child logger at the top of the file:
```ts
const log = childLogger('my-service');
log.info({ jobId, decisionId }, 'Processing');
```

Never log sensitive data (passwords, tokens, raw SQL with user data). The
API's redaction config only covers known fields — if you add a new field
with sensitive data, add it to the `redact.paths` array in
`apps/api/src/observability/logger.ts`.

### Enabling a trace UI (Jaeger or Grafana Tempo)

Currently, traces are written to collector stdout (good for dev, not queryable).
To store and search traces:

1. Add a Jaeger or Tempo container to `docker-compose.yml`
2. In `docker/otel-collector-config.yaml`, add an `otlp` exporter under
   `exporters:` pointing at the new container
3. Append the new exporter to the `traces` pipeline's `exporters` list
4. No application code changes are needed — the collector handles routing

### Extending the Grafana dashboard

The golden-signals dashboard is loaded from
`docker/grafana/provisioning/dashboards/golden-signals.json`.

To modify it:
1. Make changes in the Grafana UI
2. Export the dashboard as JSON (Dashboard → Share → Export)
3. Replace the contents of `golden-signals.json`
4. The dashboard provider polls for changes every 30 seconds
   (`updateIntervalSeconds: 30`), so a restart is not needed

### Adjusting collection frequency

- **Metric push interval** (OTel SDK → collector): `exportIntervalMillis` in
  `apps/api/src/otel.ts` and `apps/worker/src/otel.ts` (currently 30 seconds)
- **Prometheus scrape interval**: `scrape_interval` in `docker/prometheus.yml`
  (currently 15 seconds)
- **Batch flush interval** (collector): `timeout` under `processors.batch` in
  `docker/otel-collector-config.yaml` (currently 5 seconds)

Lowering these values gives fresher data but increases CPU and network overhead.
The current defaults are appropriate for development.

---

## Glossary

| Term | Meaning |
|---|---|
| **Span** | A single unit of work with a name, start time, and duration |
| **Trace** | A tree of spans representing one end-to-end operation |
| **trace_id** | A hex string that uniquely identifies a trace across all services |
| **OTLP** | OpenTelemetry Protocol — the wire format for sending spans/metrics to the collector |
| **Exporter** | Code that serialises telemetry data and sends it somewhere |
| **Instrumentation** | Code that automatically creates spans for a library (e.g., ioredis) |
| **Cardinality** | The number of unique label combinations in a metric. High cardinality (e.g., using a user ID as a label) can exhaust Prometheus memory. |
| **RED metrics** | Requests, Errors, Duration — the three metrics that matter most for any service |
| **Golden signals** | Latency, Traffic, Errors, Saturation — four metrics that define service health |
| **PromQL** | Prometheus Query Language — used to query and aggregate metric data |
| **Scrape** | Prometheus pulling metrics from a `/metrics` HTTP endpoint |
| **W3C Trace Context** | A standardised HTTP header (`traceparent`) for propagating trace IDs across services |
