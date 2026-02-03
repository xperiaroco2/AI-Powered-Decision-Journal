import { Redis } from "ioredis";

// Event types
export interface DecisionUpdateEvent {
  type: "decision:update";
  decisionId: string;
  runId: string; // Added runId for multi-run support
  status: "PROCESSING" | "COMPLETED" | "FAILED"; // Changed DONE to COMPLETED to match AnalysisRunStatus
}

// Redis Pub/Sub channel
const EVENTS_CHANNEL = "decision-events";

// Singleton Redis publisher
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    publisher = new Redis(redisUrl);
    publisher.on("error", (error) => {
      console.error("Redis publisher error:", error);
    });
  }
  return publisher;
}

// Publish run status update event
export async function publishRunUpdate(
  decisionId: string,
  runId: string,
  status: "PROCESSING" | "COMPLETED" | "FAILED"
): Promise<void> {
  try {
    const event: DecisionUpdateEvent = {
      type: "decision:update",
      decisionId,
      runId,
      status,
    };

    const redis = getPublisher();
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));

    console.log(`📡 Published event: ${status} for run ${runId} (decision ${decisionId})`);
  } catch (error) {
    console.error("Failed to publish event:", error);
    // Don't throw - event publishing should not break the main flow
  }
}

// Legacy function for backward compatibility
export async function publishDecisionUpdate(
  decisionId: string,
  status: "PROCESSING" | "DONE" | "FAILED"
): Promise<void> {
  // Map DONE to COMPLETED for new status enum
  const mappedStatus = status === "DONE" ? "COMPLETED" : status;
  await publishRunUpdate(decisionId, "legacy", mappedStatus);
}

// Export channel name for subscribers
export { EVENTS_CHANNEL };

