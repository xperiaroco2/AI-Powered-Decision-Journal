/**
 * OpenTelemetry Metrics
 *
 * RED metrics (requests, errors, duration) + runtime saturation gauges.
 * All metrics are exported via OTLP to the OTel Collector, which exposes
 * a Prometheus scrape endpoint at :9464 for Grafana.
 *
 * Prometheus metric names (after OTel → Prometheus conversion):
 *   http_requests_total{route,method,status_code}
 *   http_request_duration_seconds{route,method,status_code} (histogram)
 *   http_errors_total{route,method}
 *   process_event_loop_lag_seconds
 *   process_heap_used_bytes
 *   process_heap_total_bytes
 *   process_rss_bytes
 *   process_active_handles
 */
import { metrics } from '@opentelemetry/api';
import { monitorEventLoopDelay } from 'perf_hooks';

const meter = metrics.getMeter(
  'api',
  process.env.npm_package_version || '0.0.1',
);

// ── RED Metrics ──────────────────────────────────────────────────────────────

export const httpRequestsTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests received',
});

export const httpRequestDuration = meter.createHistogram(
  'http_request_duration_seconds',
  {
    description: 'HTTP request latency in seconds',
    unit: 's',
    advice: {
      // Prometheus-compatible bucket boundaries (seconds)
      explicitBucketBoundaries: [
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
      ],
    },
  },
);

export const httpErrorsTotal = meter.createCounter('http_errors_total', {
  description: 'Total number of HTTP 5xx errors',
});

// ── Auth Metrics ──────────────────────────────────────────────────────────────

/**
 * Total auth operations; operation = 'login' | 'register', outcome = 'success' | 'failure'.
 * Login failures include both unknown-user and wrong-password cases (deliberately
 * indistinct to avoid leaking account enumeration signal in metrics).
 */
export const authAttemptsTotal = meter.createCounter('auth_attempts_total', {
  description: 'Total authentication and registration attempts',
});

// ── Advisory / RAG Metrics ────────────────────────────────────────────────────

/**
 * Total advisory requests; type = 'decision' | 'attachment',
 * status = 'success' | 'failure'.
 */
export const advisoryRequestsTotal = meter.createCounter(
  'advisory_requests_total',
  { description: 'Total advisory (RAG) requests processed' },
);

/**
 * Duration of individual RAG pipeline stages.
 * type  = 'decision' | 'attachment'
 * stage = 'embed_question' | 'vector_search' | 'llm_generate'
 */
export const advisoryStageDuration = meter.createHistogram(
  'advisory_stage_duration_seconds',
  {
    description: 'Duration of individual RAG pipeline stages in seconds',
    unit: 's',
    advice: {
      explicitBucketBoundaries: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    },
  },
);

// ── Queue Enqueue Metrics ─────────────────────────────────────────────────────

/** Incremented for every queue.add() call; status = 'success' | 'failure'. */
export const queueEnqueueTotal = meter.createCounter('queue_enqueue_total', {
  description: 'Total number of BullMQ jobs enqueued by the API',
});

/**
 * Round-trip time (seconds) for queue.add() to write the job to Redis.
 * Only recorded on success; failures do not produce a duration sample.
 */
export const queueEnqueueDuration = meter.createHistogram(
  'queue_enqueue_duration_seconds',
  {
    description: 'Time to enqueue a BullMQ job (Redis round-trip)',
    unit: 's',
    advice: {
      explicitBucketBoundaries: [
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1,
      ],
    },
  },
);

// ── Runtime / Saturation Metrics ─────────────────────────────────────────────

/**
 * Call once during bootstrap (after OTel SDK is started) to register
 * observable gauges for Node.js runtime saturation metrics.
 */
export function registerRuntimeMetrics(): void {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  meter
    .createObservableGauge('process_event_loop_lag_seconds', {
      description: 'Node.js event loop lag mean (perf_hooks histogram)',
      unit: 's',
    })
    .addCallback((result) => {
      result.observe(histogram.mean / 1e9);
    });

  meter
    .createObservableGauge('process_heap_used_bytes', {
      description: 'V8 heap used bytes',
      unit: 'By',
    })
    .addCallback((result) => {
      result.observe(process.memoryUsage().heapUsed);
    });

  meter
    .createObservableGauge('process_heap_total_bytes', {
      description: 'V8 heap total bytes allocated',
      unit: 'By',
    })
    .addCallback((result) => {
      result.observe(process.memoryUsage().heapTotal);
    });

  meter
    .createObservableGauge('process_rss_bytes', {
      description: 'Process Resident Set Size (RSS) in bytes',
      unit: 'By',
    })
    .addCallback((result) => {
      result.observe(process.memoryUsage().rss);
    });

  meter
    .createObservableGauge('process_active_handles', {
      description: 'Number of active libuv handles (open sockets, timers, …)',
    })
    .addCallback((result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.observe(((process as any)._getActiveHandles?.() ?? []).length);
    });
}
