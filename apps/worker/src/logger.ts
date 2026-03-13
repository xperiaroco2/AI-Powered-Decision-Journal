import pino from 'pino';
import { getTraceIds } from './trace-context.helper';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Inject active OTel trace_id/span_id into every log line for trace correlation
  mixin: getTraceIds,
});

export function childLogger(name: string) {
  return logger.child({ context: name });
}
