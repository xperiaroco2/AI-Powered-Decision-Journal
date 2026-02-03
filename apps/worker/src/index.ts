import { config } from "dotenv";
import { resolve } from "path";

// Load .env from repository root (two levels up from src/)
config({ path: resolve(__dirname, "../../../.env") });

import { Worker } from "bullmq";
import { createRedisConnection } from "./config/redis";
import { QUEUE_NAME, DecisionAnalysisJobData } from "./config/queue";
import { processDecisionAnalysis } from "./processors/decision-analysis.processor";
import { getAIProvider } from "./services/ai.service";

// Initialize AI provider (logs which provider is being used)
getAIProvider();

// Create the worker
const worker = new Worker<DecisionAnalysisJobData>(
  QUEUE_NAME,
  async (job) => {
    await processDecisionAnalysis(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

// Worker event handlers
worker.on("ready", () => {
  console.log("🚀 Worker is ready and waiting for jobs");
});

worker.on("active", (job) => {
  console.log(`▶ Job ${job.id} started`);
});

worker.on("completed", (job) => {
  console.log(`✓ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing worker...`);
  try {
    await worker.close();
    console.log("Worker closed successfully");
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

console.log(`Worker started, listening to queue: ${QUEUE_NAME}`);

