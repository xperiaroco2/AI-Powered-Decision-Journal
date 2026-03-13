/**
 * Telemetry Interceptor
 *
 * Wraps every HTTP handler to:
 *  - Record RED metrics (requests_total, request_duration, errors_total).
 *  - Enrich the active OTel span with requestId and userId (post-auth).
 *  - Mark spans as ERROR on unhandled exceptions.
 *
 * Registered globally via APP_INTERCEPTOR in ObservabilityModule so it
 * runs inside the DI container (allows future injection of services).
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal,
} from './metrics';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const startNs = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        this.record(req, res.statusCode, startNs);
      }),
      catchError((err: unknown) => {
        const status =
          typeof (err as Record<string, unknown>)?.status === 'number'
            ? (err as { status: number }).status
            : 500;
        this.record(req, status, startNs, err);
        return throwError(() => err);
      }),
    );
  }

  private record(
    req: Request,
    statusCode: number,
    startNs: bigint,
    err?: unknown,
  ): void {
    const durationS = Number(process.hrtime.bigint() - startNs) / 1e9;

    // Prefer the matched route pattern (/decisions/:id) over the raw path
    const route =
      (req.route as { path?: string } | undefined)?.path ||
      req.path ||
      'unknown';
    const method = req.method || 'UNKNOWN';
    const labels = { route, method, status_code: String(statusCode) };

    httpRequestsTotal.add(1, labels);
    httpRequestDuration.record(durationS, labels);

    if (statusCode >= 500 || err) {
      httpErrorsTotal.add(1, { route, method });
    }

    // Enrich the active span with request/user context (guards have run by now)
    const span = trace.getActiveSpan();
    if (span) {
      if (req.requestId) {
        span.setAttribute('http.request_id', req.requestId);
      }

      // req.user is set by JwtAuthGuard via passport after successful auth
      // Use OTel semantic convention: enduser.id  (opaque ID, no PII)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (req as any).user as { id?: string } | undefined;
      if (user?.id) {
        span.setAttribute('enduser.id', user.id);
      }

      if (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            err instanceof Error ? err.message : 'Unhandled handler error',
        });
        if (err instanceof Error) {
          span.recordException(err);
        }
      }
    }
  }
}
