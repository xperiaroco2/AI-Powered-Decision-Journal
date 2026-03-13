/**
 * OpenTelemetry SDK Initialization for the worker process.
 *
 * This file is imported for side effects in index.ts immediately after env vars
 * are loaded via dotenv. It starts tracing + metrics export to the OTel collector.
 *
 * IMPORTANT: Do NOT register SIGTERM/SIGINT handlers here.
 * Call shutdownOtel() inside the worker's own shutdown() function instead.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME || 'worker',
    'service.version': process.env.npm_package_version || '0.0.1',
    'deployment.environment': process.env.NODE_ENV || 'local',
  }),

  traceExporter: new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  }),

  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${OTLP_ENDPOINT}/v1/metrics`,
      }),
      exportIntervalMillis: 30_000,
    }),
  ],

  instrumentations: [
    getNodeAutoInstrumentations({
      // Suppress noisy low-value instrumentations
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      // ioredis spans (BullMQ + pub/sub) and HTTP spans (AI provider calls) are useful
    }),
    // Prisma query-level spans
    new PrismaInstrumentation(),
  ],
});

sdk.start();
console.log(
  `[otel] SDK started → ${OTLP_ENDPOINT} (service: ${process.env.OTEL_SERVICE_NAME || 'worker'})`,
);

export async function shutdownOtel(): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('[otel] SDK shut down cleanly');
  } catch (err) {
    console.error('[otel] Error during shutdown:', err);
  }
}
