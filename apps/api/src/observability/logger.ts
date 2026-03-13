/**
 * Pino / nestjs-pino configuration.
 *
 * Features:
 *  - Structured JSON logs to stdout (production) or pino-pretty (development)
 *  - trace_id / span_id injected via mixin on every log line
 *  - requestId propagated from X-Request-Id header
 *  - Sensitive fields redacted before emission
 */
import type { Params } from 'nestjs-pino';
import type { LevelWithSilent } from 'pino';
import { getTraceIds } from './trace-context.helper';

const isProd = process.env.NODE_ENV === 'production';

export const pinoHttpConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',

    // Pretty-print in dev; raw JSON in production (piped to log aggregator)
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },

    // Inject OTel trace correlation into every log record
    mixin() {
      return getTraceIds();
    },

    // Propagate requestId from the NestJS middleware into the HTTP log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customProps(req: any) {
      return {
        requestId: req.requestId as string | undefined,
      };
    },

    // Map HTTP status codes to pino log levels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customLogLevel(_req: any, res: any, err: any): LevelWithSilent {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    // Redact secrets so they never appear in logs
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'req.body.password',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.secret',
        'req.body.refreshToken',
        'req.body.accessToken',
      ],
      censor: '[REDACTED]',
    },

    // Slim down the req/res objects that are serialized
    serializers: {
      req(req: Record<string, unknown>) {
        return {
          method: req.method,
          url: req.url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userAgent: (req.headers as any)?.['user-agent'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          requestId: (req.headers as any)?.['x-request-id'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          remoteAddress: (req as any).remoteAddress,
        };
      },
      res(res: Record<string, unknown>) {
        return { statusCode: res.statusCode };
      },
    },
  },
};
