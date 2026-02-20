import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Controller
 *
 * Returns aggregated statistics for the current user's decisions.
 * Migrated from: apps/web/app/api/dashboard/route.ts
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@CurrentUser() user: { id: string; email: string }) {
    return this.dashboardService.getDashboardStats(user.id);
  }
}
