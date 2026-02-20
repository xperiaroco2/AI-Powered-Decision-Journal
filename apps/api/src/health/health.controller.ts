import { Controller, Get } from '@nestjs/common';

/**
 * Health Controller
 *
 * Simple health check endpoint for monitoring.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
