// ⚠️  MUST be first: patches http/express/ioredis/prisma before NestJS loads them
import './otel';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { registerRuntimeMetrics } from './observability/metrics';

async function bootstrap() {
  // Register event-loop-lag, memory, CPU gauges (OTel SDK must be started first)
  registerRuntimeMetrics();

  const app = await NestFactory.create(AppModule, {
    // Buffer NestJS bootstrap logs until pino logger is ready
    bufferLogs: true,
  });

  // Replace default NestJS logger with pino (structured JSON + trace correlation)
  app.useLogger(app.get(Logger));

  // Handle process-level errors with trace correlation where available
  const logger = app.get(Logger);
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
      { reason: reason instanceof Error ? reason.message : String(reason) },
      'Unhandled promise rejection',
    );
  });
  process.on('uncaughtException', (error: Error) => {
    logger.error(
      { error: error.message, stack: error.stack },
      'Uncaught exception – process will exit',
    );
    process.exit(1);
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Enable CORS for Next.js frontend
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      transform: true, // Transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 NestJS API running on http://localhost:${port}`);
}

bootstrap();
