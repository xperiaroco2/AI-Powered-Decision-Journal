import { Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from './redis';

// Queue name constant
export const EMBEDDING_QUEUE_NAME = 'decision-embedding';

// Job data interface
export interface DecisionEmbeddingJobData {
  decisionId: string;
}

// Create queue options
function getQueueOptions(): QueueOptions {
  return {
    connection: createRedisConnection(),
  };
}

// Create and export the queue
export function createDecisionEmbeddingQueue(): Queue<DecisionEmbeddingJobData> {
  return new Queue<DecisionEmbeddingJobData>(
    EMBEDDING_QUEUE_NAME,
    getQueueOptions(),
  );
}
