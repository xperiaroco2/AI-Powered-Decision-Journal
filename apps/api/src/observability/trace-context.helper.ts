/**
 * W3C Trace Context helpers for BullMQ job propagation.
 *
 * PRODUCER (API side – this file):
 *   const job = await queue.add('my-job', injectTraceContext({ runId }));
 *
 * CONSUMER (worker side – copy extractTraceContext there):
 *   import { context } from '@opentelemetry/api';
 *   const parentCtx = extractTraceContext(job.data);
 *   context.with(parentCtx, () => {
 *     tracer.startActiveSpan('worker.process', (span) => { … span.end(); });
 *   });
 *
 * IMPORTANT: never place PII in tracing attributes.
 * The __otel carrier only holds traceparent/tracestate headers (opaque hex IDs).
 */
import {
  context,
  propagation,
  trace,
  isSpanContextValid,
} from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

/** Injects W3C traceparent/tracestate into the BullMQ job data payload. */
export function injectTraceContext<T extends Record<string, unknown>>(
  data: T,
): T & { __otel: Record<string, string> } {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return { ...data, __otel: carrier };
}

/**
 * Extracts the parent OTel context from a BullMQ job data payload.
 * Call this in the worker before starting the processing span.
 */
export function extractTraceContext(data: Record<string, unknown>): Context {
  const carrier = (data.__otel as Record<string, string>) ?? {};
  return propagation.extract(context.active(), carrier);
}

/**
 * Returns trace_id / span_id for the currently active span.
 * Used as a pino mixin so every log line is correlated with its trace.
 */
export function getTraceIds(): {
  trace_id?: string;
  span_id?: string;
  trace_flags?: number;
} {
  const span = trace.getActiveSpan();
  if (!span) return {};

  const ctx = span.spanContext();
  if (!isSpanContextValid(ctx)) return {};

  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    trace_flags: ctx.traceFlags,
  };
}
