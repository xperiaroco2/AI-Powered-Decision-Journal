import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Dashboard API Route
 * 
 * Returns aggregated statistics for the current user's decisions:
 * - Category frequency (count per category)
 * - Bias frequency (count per bias name)
 * 
 * Only includes latest COMPLETED analysis run per decision.
 */

export async function GET() {
  try {
    // 1. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Fetch all decisions with their latest COMPLETED run
    // Only include decisions where latestRun exists and is COMPLETED
    const decisions = await prisma.decision.findMany({
      where: {
        userId,
        latestRun: {
          status: "COMPLETED",
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

    // 3. Aggregate category frequency
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

    // 4. Aggregate bias frequency
    const biasMap = new Map<string, number>();
    decisions.forEach((decision) => {
      const biases = decision.latestRun?.biasesText || [];
      biases.forEach((bias) => {
        biasMap.set(bias, (biasMap.get(bias) || 0) + 1);
      });
    });

    // Convert to array and sort by count (descending), limit to top 10
    const biases = Array.from(biasMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 biases

    // 5. Return aggregated data
    return NextResponse.json({
      totalDecisions: decisions.length,
      categories,
      biases,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

