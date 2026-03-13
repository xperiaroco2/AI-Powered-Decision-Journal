/**
 * Request Context Middleware
 *
 * Runs on every inbound request, before route handlers.
 * Responsibilities:
 *  1. Ensure X-Request-Id header is present (generate UUID v4 if absent).
 *  2. Echo requestId back in the response header.
 *  3. Attach requestId to the active OTel span as an attribute.
 *  4. After passport runs (req.user exists), attach enduser.id to the span.
 *
 * NOTE: userId enrichment happens in the TelemetryInterceptor (post-auth),
 * because middleware runs before guards. The middleware handles requestId only.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

// Extend Express Request type with our custom field
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use incoming header if present (from gateway/load-balancer), else generate
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    // The auto-instrumentation for HTTP already created an active span by now.
    // Decorate it with our requestId so it shows up in trace viewers.
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('http.request_id', requestId);
    }

    next();
  }
}
