import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  console.log(`🚀 NestJS API running on http://localhost:${port}`);
}

bootstrap();
