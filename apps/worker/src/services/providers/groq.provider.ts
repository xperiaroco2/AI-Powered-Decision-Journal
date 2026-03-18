import { PrismaClient } from '@prisma/client';
import { AIProvider, DecisionInput, AnalysisResult } from './types';
import { DecisionAnalysisOrchestrator } from '../orchestration/orchestrator';
import { TelemetryEvent } from '../orchestration/types';
import { childLogger } from '../../logger';

const log = childLogger('groq-provider');

/**
 * Groq AI Provider
 *
 * Production-grade orchestration with:
 * - Multi-step LLM workflow (analyze → reflect → synthesize)
 * - Retry logic with exponential backoff
 * - Structured output validation with Zod
 * - User context/memory integration
 * - Semantic input validation
 * - Telemetry and observability
 */
export class GroqProvider implements AIProvider {
  private orchestrator: DecisionAnalysisOrchestrator;
  private userId: string | null = null;
  private runId: string | null = null;

  constructor(apiKey: string, prisma: PrismaClient) {
    // Initialize orchestrator with telemetry
    this.orchestrator = new DecisionAnalysisOrchestrator(
      apiKey,
      prisma,
      this.telemetryLogger.bind(this),
    );
  }

  /**
   * Set context for the current analysis
   * This should be called before analyze() to provide user context
   */
  setContext(userId: string, runId: string): void {
    this.userId = userId;
    this.runId = runId;
  }

  /**
   * Analyze decision using orchestration workflow
   */
  async analyze(input: DecisionInput): Promise<AnalysisResult> {
    if (!this.userId || !this.runId) {
      throw new Error('Context not set. Call setContext() before analyze()');
    }

    try {
      // Execute orchestration
      const result = await this.orchestrator.execute(
        input,
        this.userId,
        this.runId,
      );

      // Transform orchestration result to AnalysisResult format
      return this.transformResult(result);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Orchestration error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Transform orchestration result to AnalysisResult format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformResult(result: any): AnalysisResult {
    const { analysis } = result;

    // Transform structured insights back to simple strings for backward compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insights = analysis.insights.map((insight: any) => {
      const prefix = this.getInsightPrefix(insight.type);
      return `${prefix}${insight.content}`;
    });

    // Transform missed alternatives
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missedAlternatives = analysis.missedAlternatives.map((alt: any) => {
      return `${alt.alternative} (Feasibility: ${alt.feasibility || 'MEDIUM'})`;
    });

    return {
      category: analysis.category,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cognitiveBiases: analysis.cognitiveBiases.map((bias: any) => ({
        name: bias.name,
        description: bias.description,
      })),
      missedAlternatives,
      insights,
      rawAiResponse: JSON.stringify(result.rawOutputs, null, 2),
    };
  }

  /**
   * Get insight prefix based on type
   */
  private getInsightPrefix(type: string): string {
    switch (type) {
      case 'STRENGTH':
        return '✓ ';
      case 'WEAKNESS':
        return '⚠ ';
      case 'RECOMMENDATION':
        return '→ ';
      case 'RISK':
        return '⚡ ';
      default:
        return '';
    }
  }

  /**
   * Telemetry logger
   */
  private telemetryLogger(event: TelemetryEvent): void {
    const base = {
      runId: event.runId,
      eventType: event.eventType,
      stepName: event.stepName,
    };

    switch (event.eventType) {
      case 'STEP_START':
        log.info(base, 'Starting step');
        break;

      case 'STEP_COMPLETE':
        log.info(
          { ...base, durationMs: event.durationMs, ...(event.metadata || {}) },
          'Step completed',
        );
        break;

      case 'STEP_ERROR':
        log.error({ ...base, err: event.error }, 'Error in step');
        break;

      case 'LLM_CALL':
        log.info({ ...base, ...(event.metadata || {}) }, 'LLM call');
        break;

      case 'RETRY':
        log.warn({ ...base, ...(event.metadata || {}) }, 'Retry attempt');
        break;

      case 'VALIDATION_ERROR':
        log.error({ ...base, err: event.error }, 'Validation error');
        break;

      default:
        log.info({ ...base, ...(event.metadata || {}) }, 'Telemetry event');
    }
  }
}
