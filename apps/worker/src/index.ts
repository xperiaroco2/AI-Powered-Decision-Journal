import { config } from "dotenv";
import { resolve } from "path";

// Load .env from repository root (two levels up from src/)
config({ path: resolve(__dirname, "../../../.env") });

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

// Initialize providers (logs which providers are being used)
getAIProvider();
getEmbeddingProvider();

// Create the decision analysis worker
const analysisWorker = new Worker<DecisionAnalysisJobData>(
  QUEUE_NAME,
  async (job) => {
    await processDecisionAnalysis(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5, // Process up to 5 jobs concurrently
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
    concurrency: 10, // Embeddings are faster, allow more concurrency
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
    concurrency: 3, // Lower concurrency due to chunking overhead
  }
);

// Analysis worker event handlers
analysisWorker.on("ready", () => {
  console.log("🚀 Analysis worker is ready and waiting for jobs");
});

analysisWorker.on("active", (job) => {
  console.log(`▶ Analysis job ${job.id} started`);
});

analysisWorker.on("completed", (job) => {
  console.log(`✓ Analysis job ${job.id} completed`);
});

analysisWorker.on("failed", (job, err) => {
  console.error(`✗ Analysis job ${job?.id} failed:`, err.message);
});

analysisWorker.on("error", (err) => {
  console.error("Analysis worker error:", err);
});

// Embedding worker event handlers
embeddingWorker.on("ready", () => {
  console.log("🚀 Embedding worker is ready and waiting for jobs");
});

embeddingWorker.on("active", (job) => {
  console.log(`▶ Embedding job ${job.id} started`);
});

embeddingWorker.on("completed", (job) => {
  console.log(`✓ Embedding job ${job.id} completed`);
});

embeddingWorker.on("failed", (job, err) => {
  console.error(`✗ Embedding job ${job?.id} failed:`, err.message);
});

embeddingWorker.on("error", (err) => {
  console.error("Embedding worker error:", err);
});

// Attachment worker event handlers
attachmentWorker.on("ready", () => {
  console.log("🚀 Attachment worker is ready and waiting for jobs");
});

attachmentWorker.on("active", (job) => {
  console.log(`▶ Attachment job ${job.id} started`);
});

attachmentWorker.on("completed", (job) => {
  console.log(`✓ Attachment job ${job.id} completed`);
});

attachmentWorker.on("failed", (job, err) => {
  console.error(`✗ Attachment job ${job?.id} failed:`, err.message);
});

attachmentWorker.on("error", (err) => {
  console.error("Attachment worker error:", err);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing workers...`);
  try {
    await Promise.all([
      analysisWorker.close(),
      embeddingWorker.close(),
      attachmentWorker.close(),
    ]);
    console.log("Workers closed successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  shutdown("UNHANDLED_REJECTION");
});

console.log(`Workers started:`);
console.log(`  - Analysis queue: ${QUEUE_NAME}`);
console.log(`  - Embedding queue: ${EMBEDDING_QUEUE_NAME}`);
console.log(`  - Attachment queue: ${ATTACHMENT_QUEUE_NAME}`);

