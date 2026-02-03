import { Queue, QueueOptions } from "bullmq";
import { createRedisConnection } from "./redis";

// Queue name constant
export const QUEUE_NAME = "decision-analysis";

// Job data interface
export interface DecisionAnalysisJobData {
  runId: string; // Changed from decisionId to runId for multi-run support
}

// Create queue options
function getQueueOptions(): QueueOptions {
  return {
    connection: createRedisConnection(),
  };
}

// Create and export the queue
export function createDecisionAnalysisQueue(): Queue<DecisionAnalysisJobData> {
  return new Queue<DecisionAnalysisJobData>(QUEUE_NAME, getQueueOptions());
}

