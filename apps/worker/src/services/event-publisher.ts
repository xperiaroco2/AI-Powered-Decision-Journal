import { Redis } from 'ioredis';
import { childLogger } from '../logger';

const log = childLogger('event-publisher');

// Event types
export interface DecisionUpdateEvent {
  type: 'decision:update';
  decisionId: string;
  runId: string; // Added runId for multi-run support
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; // Changed DONE to COMPLETED to match AnalysisRunStatus
}

export interface AttachmentUpdateEvent {
  type: 'attachment:update';
  attachmentId: string;
  decisionId: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  error?: string;
}

// Redis Pub/Sub channel
const EVENTS_CHANNEL = 'decision-events';

// Singleton Redis publisher
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    publisher = new Redis(redisUrl);
    publisher.on('error', (error) => {
      log.error({ err: error }, 'Redis publisher error');
    });
  }
  return publisher;
}

// Publish run status update event
export async function publishRunUpdate(
  decisionId: string,
  runId: string,
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
): Promise<void> {
  try {
    const event: DecisionUpdateEvent = {
      type: 'decision:update',
      decisionId,
      runId,
      status,
    };

    const redis = getPublisher();
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));

    log.info({ decisionId, runId, status }, 'Published decision event');
  } catch (error) {
    log.error({ err: error }, 'Failed to publish event');
    // Don't throw - event publishing should not break the main flow
  }
}

// Publish attachment status update event
export async function publishAttachmentUpdate(
  attachmentId: string,
  decisionId: string,
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED',
  error?: string,
): Promise<void> {
  try {
    const event: AttachmentUpdateEvent = {
      type: 'attachment:update',
      attachmentId,
      decisionId,
      status,
      error,
    };

    const redis = getPublisher();
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));

    log.info(
      { attachmentId, decisionId, status },
      'Published attachment event',
    );
  } catch (error) {
    log.error({ err: error }, 'Failed to publish attachment event');
    // Don't throw - event publishing should not break the main flow
  }
}

// Export channel name for subscribers
export { EVENTS_CHANNEL };
