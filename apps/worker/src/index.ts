import { config } from "dotenv";
import { resolve } from "path";

// Load .env from repository root (two levels up from src/)
config({ path: resolve(__dirname, "../../../.env") });

// OTel SDK must start after env vars are loaded but before any instrumented modules
// are first used. OTEL_* env vars come from Docker/system env, not .env.
import { shutdownOtel } from "./otel";

import { Worker } from "bullmq";
import { createRedisConnection } from "./config/redis";
import { QUEUE_NAME, DecisionAnalysisJobData } from "./config/queue";
import {
  EMBEDDING_QUEUE_NAME,
  DecisionEmbeddingJobData,
} from "./config/embedding-queue";
import {
  ATTACHMENT_QUEUE_NAME,
  AttachmentEmbeddingJobData,
} from "./config/attachment-queue";
import { processDecisionAnalysis } from "./processors/decision-analysis.processor";
import { processDecisionEmbedding } from "./processors/decision-embedding.processor";
import { processAttachmentEmbedding } from "./processors/attachment-embedding.processor";
import { getAIProvider } from "./services/ai.service";
import { getEmbeddingProvider } from "./services/embedding.service";
import { logger } from "./logger";
import {
  jobsTotal,
  jobDurationSeconds,
  startMetricsServer,
} from "./metrics";

// Initialize providers (logs which providers are being used)
getAIProvider();
getEmbeddingProvider();

// Start Prometheus metrics scrape endpoint
const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9465', 10);
startMetricsServer(METRICS_PORT);

// Create the decision analysis worker
const analysisWorker = new Worker<DecisionAnalysisJobData>(
  QUEUE_NAME,
  async (job) => {
    await processDecisionAnalysis(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

// Create the decision embedding worker
const embeddingWorker = new Worker<DecisionEmbeddingJobData>(
  EMBEDDING_QUEUE_NAME,
  async (job) => {
    await processDecisionEmbedding(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 10,
  }
);

// Create the attachment embedding worker
const attachmentWorker = new Worker<AttachmentEmbeddingJobData>(
  ATTACHMENT_QUEUE_NAME,
  async (job) => {
    await processAttachmentEmbedding(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 3,
  }
);

// ── Analysis worker event handlers ────────────────────────────────────────────
analysisWorker.on("ready", () => {
  logger.info("Analysis worker ready");
});

analysisWorker.on("active", (job) => {
  logger.info({ jobId: job.id }, "Analysis job started");
});

analysisWorker.on("completed", (job) => {
  const durationMs =
    job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  jobsTotal.inc({ queue: QUEUE_NAME, status: 'completed' });
  if (durationMs > 0) jobDurationSeconds.observe({ queue: QUEUE_NAME }, durationMs / 1000);
  logger.info({ jobId: job.id }, "Analysis job completed");
});

analysisWorker.on("failed", (job, err) => {
  jobsTotal.inc({ queue: QUEUE_NAME, status: 'failed' });
  logger.error({ jobId: job?.id, err: err.message }, "Analysis job failed");
});

analysisWorker.on("error", (err) => {
  logger.error({ err }, "Analysis worker error");
});

// ── Embedding worker event handlers ───────────────────────────────────────────
embeddingWorker.on("ready", () => {
  logger.info("Embedding worker ready");
});

embeddingWorker.on("active", (job) => {
  logger.info({ jobId: job.id }, "Embedding job started");
});

embeddingWorker.on("completed", (job) => {
  const durationMs =
    job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  jobsTotal.inc({ queue: EMBEDDING_QUEUE_NAME, status: 'completed' });
  if (durationMs > 0) jobDurationSeconds.observe({ queue: EMBEDDING_QUEUE_NAME }, durationMs / 1000);
  logger.info({ jobId: job.id }, "Embedding job completed");
});

embeddingWorker.on("failed", (job, err) => {
  jobsTotal.inc({ queue: EMBEDDING_QUEUE_NAME, status: 'failed' });
  logger.error({ jobId: job?.id, err: err.message }, "Embedding job failed");
});

embeddingWorker.on("error", (err) => {
  logger.error({ err }, "Embedding worker error");
});

// ── Attachment worker event handlers ──────────────────────────────────────────
attachmentWorker.on("ready", () => {
  logger.info("Attachment worker ready");
});

attachmentWorker.on("active", (job) => {
  logger.info({ jobId: job.id }, "Attachment job started");
});

attachmentWorker.on("completed", (job) => {
  const durationMs =
    job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  jobsTotal.inc({ queue: ATTACHMENT_QUEUE_NAME, status: 'completed' });
  if (durationMs > 0) jobDurationSeconds.observe({ queue: ATTACHMENT_QUEUE_NAME }, durationMs / 1000);
  logger.info({ jobId: job.id }, "Attachment job completed");
});

attachmentWorker.on("failed", (job, err) => {
  jobsTotal.inc({ queue: ATTACHMENT_QUEUE_NAME, status: 'failed' });
  logger.error({ jobId: job?.id, err: err.message }, "Attachment job failed");
});

attachmentWorker.on("error", (err) => {
  logger.error({ err }, "Attachment worker error");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received, closing workers");
  try {
    await Promise.all([
      analysisWorker.close(),
      embeddingWorker.close(),
      attachmentWorker.close(),
    ]);
    await shutdownOtel();
    logger.info("Workers closed successfully");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  shutdown("UNHANDLED_REJECTION");
});

logger.info(
  { analysisQueue: QUEUE_NAME, embeddingQueue: EMBEDDING_QUEUE_NAME, attachmentQueue: ATTACHMENT_QUEUE_NAME },
  "Workers started"
);
