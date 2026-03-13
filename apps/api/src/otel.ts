/**
 * OpenTelemetry SDK Initialization
 *
 * MUST be the first import in main.ts so instrumentations patch modules
 * before they are first required by NestJS/Express.
 *
 * Import order in main.ts:
 *   import './otel';          // ← this file, first
 *   import { NestFactory } …  // ← then NestJS
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

const resource = resourceFromAttributes({
  'service.name': process.env.OTEL_SERVICE_NAME || 'api',
  'service.version': process.env.npm_package_version || '0.0.1',
  'deployment.environment': process.env.NODE_ENV || 'local',
});

const sdk = new NodeSDK({
  resource,

  // ── Traces ──────────────────────────────────────────────────────────────
  traceExporter: new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  }),

  // ── Metrics ─────────────────────────────────────────────────────────────
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${OTLP_ENDPOINT}/v1/metrics`,
      }),
      exportIntervalMillis: 30_000,
    }),
  ],

  // ── Instrumentations ────────────────────────────────────────────────────
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable extremely noisy instrumentations
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      // HTTP + Express + ioredis are auto-enabled
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
    }),
    // Prisma query-level spans
    new PrismaInstrumentation(),
  ],
});

sdk.start();
console.log(
  `[otel] SDK started → ${OTLP_ENDPOINT} (service: ${process.env.OTEL_SERVICE_NAME || 'api'})`,
);

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdownOtel() {
  try {
    await sdk.shutdown();
    console.log('[otel] SDK shut down cleanly');
  } catch (err) {
    console.error('[otel] Error during shutdown:', err);
  }
}

process.on('SIGTERM', () => void shutdownOtel().then(() => process.exit(0)));
process.on('SIGINT', () => void shutdownOtel().then(() => process.exit(0)));
