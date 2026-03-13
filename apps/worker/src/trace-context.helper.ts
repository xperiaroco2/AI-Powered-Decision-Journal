/**
 * W3C Trace Context helpers — worker side.
 *
 * Counterpart to apps/api/src/observability/trace-context.helper.ts.
 * extractTraceContext() restores the parent span that was injected by the API
 * when the BullMQ job was enqueued, enabling end-to-end distributed traces.
 */
import {
  context,
  propagation,
  trace,
  isSpanContextValid,
} from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

/**
 * Extracts the parent OTel context from a BullMQ job data payload.
 * Call this at the top of each processor, before starting the processing span.
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
