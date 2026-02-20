import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dashboard Service
 *
 * Computes aggregated statistics for user's decisions.
 * Migrated from: apps/web/app/api/dashboard/route.ts
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(userId: string) {
    // 1. Fetch all decisions with their latest COMPLETED run
    const decisions = await this.prisma.decision.findMany({
      where: {
        userId,
        latestRun: {
          status: 'COMPLETED',
        },
      },
      include: {
        latestRun: {
          select: {
            categoryText: true,
            biasesText: true,
          },
        },
      },
    });

    // 2. Aggregate category frequency
    const categoryMap = new Map<string, number>();
    decisions.forEach((decision) => {
      const category = decision.latestRun?.categoryText;
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
    });

    // Convert to array and sort by count (descending)
    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 3. Aggregate bias frequency
    const biasMap = new Map<string, number>();
    decisions.forEach((decision) => {
      const biases = decision.latestRun?.biasesText || [];
      biases.forEach((bias: string) => {
        biasMap.set(bias, (biasMap.get(bias) || 0) + 1);
      });
    });

    // Convert to array and sort by count (descending), limit to top 10
    const biases = Array.from(biasMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 biases

    // 4. Return aggregated data
    return {
      totalDecisions: decisions.length,
      categories,
      biases,
    };
  }
}
