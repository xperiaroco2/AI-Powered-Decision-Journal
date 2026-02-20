import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Module
 *
 * Provides aggregated statistics for user's decisions.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
