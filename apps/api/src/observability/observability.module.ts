/**
 * Observability Module
 *
 * Single NestJS module that wires up all observability concerns:
 *  - Structured JSON logging (nestjs-pino / pino-http)
 *  - Request-context middleware (X-Request-Id, span attributes)
 *  - Global HTTP metrics + span enrichment (TelemetryInterceptor via APP_INTERCEPTOR)
 *  - Global exception capture (AllExceptionsFilter via APP_FILTER)
 *
 * Import this module ONCE in AppModule (before other modules).
 */
import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { Logger } from 'nestjs-pino';

import { pinoHttpConfig } from './logger';
import { RequestContextMiddleware } from './request-context.middleware';
import { TelemetryInterceptor } from './telemetry.interceptor';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Global()
@Module({
  imports: [LoggerModule.forRoot(pinoHttpConfig)],
  providers: [
    RequestContextMiddleware,

    // Global interceptor: RED metrics + span enrichment on every handler
    {
      provide: APP_INTERCEPTOR,
      useClass: TelemetryInterceptor,
    },

    // Global exception filter: span ERROR status + error metrics + structured log
    // Note: AllExceptionsFilter has Logger injected, so we register via DI here
    Logger, // provide pino Logger so AllExceptionsFilter can inject it
    {
      provide: APP_FILTER,
      useFactory: (logger: Logger) => new AllExceptionsFilter(logger),
      inject: [Logger],
    },
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule implements NestModule {
  // Apply request-context middleware to ALL routes
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
