import { Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from './redis';

// Queue name constant
export const ATTACHMENT_QUEUE_NAME = 'attachment-embedding';

// Job data interface
export interface AttachmentEmbeddingJobData {
  attachmentId: string;
  filename?: string; // Optional filename for file type detection
}

// Create queue options
function getQueueOptions(): QueueOptions {
  return {
    connection: createRedisConnection(),
  };
}

// Create and export the queue
export function createAttachmentEmbeddingQueue(): Queue<AttachmentEmbeddingJobData> {
  return new Queue<AttachmentEmbeddingJobData>(
    ATTACHMENT_QUEUE_NAME,
    getQueueOptions(),
  );
}
