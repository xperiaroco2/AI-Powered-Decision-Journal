/**
 * Global Exception Filter
 *
 * Catches ALL unhandled exceptions (HttpException and generic Error).
 * For each exception:
 *  - Sets the active span status to ERROR and records the exception.
 *  - Increments the http_errors_total counter for 5xx responses.
 *  - Emits a structured error log with requestId and trace correlation.
 *  - Returns a standardised JSON error body to the client.
 *
 * Registered globally via APP_FILTER in ObservabilityModule.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from 'nestjs-pino';
import { httpErrorsTotal } from './metrics';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const route =
      (req.route as { path?: string } | undefined)?.path ||
      req.path ||
      'unknown';
    const method = req.method;

    // ── OTel span decoration ──────────────────────────────────────────────
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message:
          exception instanceof Error ? exception.message : String(exception),
      });
      if (exception instanceof Error) {
        span.recordException(exception);
      }
      if (req.requestId) {
        span.setAttribute('http.request_id', req.requestId);
      }
    }

    // ── Metrics ───────────────────────────────────────────────────────────
    if (status >= 500) {
      httpErrorsTotal.add(1, { route, method });

      // Structured error log – trace_id / span_id are added by pino mixin
      this.logger.error({
        requestId: req.requestId,
        method,
        url: req.url,
        statusCode: status,
        errorMessage:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      ...(typeof responseBody === 'object' && responseBody !== null
        ? responseBody
        : { message: responseBody }),
    });
  }
}
