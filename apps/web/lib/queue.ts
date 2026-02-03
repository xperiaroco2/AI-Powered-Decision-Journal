import { Queue } from "bullmq";
import { Redis } from "ioredis";

// Queue name - must match worker
const QUEUE_NAME = "decision-analysis";

// Job data interface
export interface DecisionAnalysisJobData {
  runId: string; // Changed from decisionId to runId for multi-run support
}

// Singleton Redis connection for the queue
let redisConnection: Redis | null = null;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    // Parse URL to check for TLS
    const isTLS = redisUrl.startsWith("rediss://");

    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      // Enable TLS for production Redis (Upstash, Redis Cloud, etc.)
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
    });

    redisConnection.on("error", (error) => {
      console.error("Redis connection error:", error);
    });
  }

  return redisConnection;
}

// Singleton queue instance
let queueInstance: Queue<DecisionAnalysisJobData> | null = null;

function getQueue(): Queue<DecisionAnalysisJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<DecisionAnalysisJobData>(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }

  return queueInstance;
}

// Enqueue an analysis run
export async function enqueueAnalysisRun(runId: string): Promise<void> {
  const queue = getQueue();

  await queue.add(
    "analyze-decision",
    { runId },
    {
      attempts: 3, // Retry up to 3 times on failure
      backoff: {
        type: "exponential",
        delay: 2000, // Start with 2 second delay
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    }
  );

  console.log(`✓ Enqueued run ${runId} for analysis`);
}

