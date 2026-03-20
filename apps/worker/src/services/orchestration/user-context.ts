import { PrismaClient, Category } from '@prisma/client';
import { UserContext, UserDecisionPattern } from './types';

/**
 * User Context Manager
 *
 * Lightweight memory system that provides user-specific context to the LLM.
 * No vector DB - just aggregated patterns from recent decisions.
 *
 * This allows the AI to:
 * - Recognize recurring biases
 * - Adapt tone based on user history
 * - Provide personalized insights
 */

export class UserContextManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Build user context from recent decision history
   */
  async buildContext(userId: string): Promise<UserContext> {
    // Fetch recent decisions (last 10)
    const recentDecisions = await this.prisma.decision.findMany({
      where: {
        userId,
        status: 'DONE',
      },
      include: {
        latestRun: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Extract patterns
    const patterns = this.extractPatterns(recentDecisions);

    // Build context
    return {
      userId,
      patterns,
      recentDecisions: recentDecisions
        .filter((d) => d.latestRun?.resultJson)
        .map((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = d.latestRun!.resultJson as any;
          return {
            category: result.category as Category,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            biases: result.cognitiveBiases?.map((b: any) => b.name) || [],
            createdAt: d.createdAt,
          };
        })
        .slice(0, 5), // Only keep 5 most recent for context
    };
  }

  /**
   * Extract decision patterns from user history
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractPatterns(decisions: any[]): UserDecisionPattern {
    const categoryCount = new Map<Category, number>();
    const biasCount = new Map<string, number>();

    for (const decision of decisions) {
      if (!decision.latestRun?.resultJson) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = decision.latestRun.resultJson as any;

      // Count categories
      const category = result.category as Category;
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);

      // Count biases
      const biases = result.cognitiveBiases || [];
      for (const bias of biases) {
        const name = bias.name;
        biasCount.set(name, (biasCount.get(name) || 0) + 1);
      }
    }

    // Get top 3 categories
    const commonCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Get top 5 biases
    const frequentBiases = Array.from(biasCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bias]) => bias);

    return {
      commonCategories,
      frequentBiases,
      decisionCount: decisions.length,
      lastDecisionDate: decisions[0]?.createdAt || null,
    };
  }

  /**
   * Format user context for LLM prompt
   */
  formatForPrompt(context: UserContext | null): string {
    if (!context || context.patterns.decisionCount === 0) {
      return "This is the user's first decision analysis.";
    }

    const { patterns, recentDecisions } = context;

    let prompt = `USER CONTEXT:\n`;
    prompt += `- Total decisions analyzed: ${patterns.decisionCount}\n`;

    if (patterns.commonCategories.length > 0) {
      prompt += `- Common decision areas: ${patterns.commonCategories.join(', ')}\n`;
    }

    if (patterns.frequentBiases.length > 0) {
      prompt += `- Recurring cognitive biases: ${patterns.frequentBiases.join(', ')}\n`;
      prompt += `  → Pay special attention to these patterns in your analysis\n`;
    }

    if (recentDecisions.length > 0) {
      prompt += `\nRECENT DECISIONS:\n`;
      recentDecisions.slice(0, 3).forEach((d, i) => {
        prompt += `${i + 1}. ${d.category} decision`;
        if (d.biases.length > 0) {
          prompt += ` (biases: ${d.biases.slice(0, 2).join(', ')})`;
        }
        prompt += `\n`;
      });
    }

    prompt += `\nUse this context to provide personalized insights and identify recurring patterns.`;

    return prompt;
  }
}
