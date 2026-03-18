import { Redis } from 'ioredis';
import { childLogger } from '../logger';

const log = childLogger('redis');

// Redis connection configuration
export function createRedisConnection(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  // Parse URL to check for TLS
  const isTLS = redisUrl.startsWith('rediss://');

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    // Enable TLS for production Redis (Upstash, Redis Cloud, etc.)
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
  });

  redis.on('error', (error) => {
    log.error({ err: error }, 'Redis connection error');
  });

  redis.on('connect', () => {
    log.info('Connected to Redis');
  });

  return redis;
}
