import { PrismaClient } from '@prisma/client';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { LLMClient } from './llm-client';
import { LangChainLLMClient } from './langchain-client';
import { childLogger } from '../../logger';

const log = childLogger('orchestrator');
const tracer = trace.getTracer('worker');
import { UserContextManager } from './user-context';
import { InputValidator } from './input-validator';
import { PromptBuilder } from './prompts';
import {
  OrchestrationContext,
  OrchestrationResult,
  StepResult,
  TelemetryEvent,
  TelemetryLogger,
  InitialAnalysisSchema,
  ReflectionSchema,
  FinalAnalysisSchema,
  DecisionInputSchema,
} from './types';

/**
 * Decision Analysis Orchestrator
 *
 * Production-grade LLM orchestration with:
 * - Multi-step workflow (analyze → reflect → synthesize)
 * - Retry logic with exponential backoff
 * - Structured output validation
 * - User context integration
 * - Telemetry and observability
 *
 * Architecture:
 * 1. Input validation (semantic + schema)
 * 2. User context loading
 * 3. Step 1: Initial Analysis (deterministic, temp=0.3)
 * 4. Step 2: Reflection (creative, temp=0.7)
 * 5. Step 3: Final Synthesis (balanced, temp=0.5)
 *
 * Now powered by LangChain and LangGraph!
 */

export class DecisionAnalysisOrchestrator {
  private llmClient: LLMClient; // Keep for backward compatibility
  private langChainClient: LangChainLLMClient;
  private userContextManager: UserContextManager;
  private inputValidator: InputValidator;
  private promptBuilder: PromptBuilder;
  private telemetryLogger: TelemetryLogger;
  private useLangChain: boolean;

  constructor(
    apiKey: string,
    prisma: PrismaClient,
    telemetryLogger?: TelemetryLogger,
    useLangChain: boolean = true, // Feature flag to enable/disable LangChain
  ) {
    this.llmClient = new LLMClient(apiKey);
    this.langChainClient = new LangChainLLMClient(apiKey);
    this.userContextManager = new UserContextManager(prisma);
    this.inputValidator = new InputValidator();
    this.promptBuilder = new PromptBuilder();
    this.telemetryLogger = telemetryLogger || this.defaultTelemetryLogger;
    this.useLangChain = useLangChain;
  }

  /**
   * Execute full orchestration workflow
   *
   * Now supports both legacy (direct LLM calls) and LangGraph workflows.
   */
  async execute(
    input: unknown,
    userId: string,
    runId: string,
  ): Promise<OrchestrationResult> {
    // Step 0: Input Validation
    const validationResult = this.inputValidator.validate(input);
    if (!validationResult.valid) {
      throw new Error(
        `Input validation failed: ${validationResult.errors.join(', ')}`,
      );
    }

    const validatedInput = DecisionInputSchema.parse(input);

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      log.info({ warnings: validationResult.warnings }, 'Input warnings');
    }

    // Step 1: Load User Context
    const userContext = await this.userContextManager.buildContext(userId);

    const context: OrchestrationContext = {
      input: validatedInput,
      userContext,
      runId,
      provider: 'groq',
    };

    // Choose execution path based on feature flag
    if (this.useLangChain) {
      log.info({ runId }, 'Using LangChain-based workflow');
      return await this.executeLangChainWorkflow(context);
    } else {
      log.info({ runId }, 'Using legacy Groq SDK workflow');
      return await this.executeLegacyWorkflow(context);
    }
  }

  /**
   * LangChain-based workflow execution
   * Uses LangChain's ChatGroq instead of direct Groq SDK
   */
  private async executeLangChainWorkflow(
    context: OrchestrationContext,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = ['validation', 'user-context'];
    let totalRetries = 0;

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'orchestration-langchain',
    });

    try {
      // Step 2: Initial Analysis using LangChain
      const initialResult = await this.runStep(
        'orchestration.initial-analysis',
        context.runId,
        () => this.executeInitialAnalysisLangChain(context),
      );
      if (!initialResult.success || !initialResult.data) {
        throw new Error(`Initial analysis failed: ${initialResult.error}`);
      }
      stepsExecuted.push('initial-analysis');
      totalRetries += initialResult.retryCount;

      // Step 3: Reflection using LangChain
      const reflectionResult = await this.runStep(
        'orchestration.reflection',
        context.runId,
        () => this.executeReflectionLangChain(context, initialResult.data),
      );
      if (!reflectionResult.success || !reflectionResult.data) {
        throw new Error(`Reflection failed: ${reflectionResult.error}`);
      }
      stepsExecuted.push('reflection');
      totalRetries += reflectionResult.retryCount;

      // Step 4: Final Synthesis using LangChain
      const finalResult = await this.runStep(
        'orchestration.final-synthesis',
        context.runId,
        () =>
          this.executeFinalSynthesisLangChain(
            context,
            initialResult.data,
            reflectionResult.data,
          ),
      );
      if (!finalResult.success || !finalResult.data) {
        throw new Error(`Final synthesis failed: ${finalResult.error}`);
      }
      stepsExecuted.push('final-synthesis');
      totalRetries += finalResult.retryCount;

      const totalDuration = Date.now() - startTime;

      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'orchestration-langchain',
        durationMs: totalDuration,
        metadata: {
          stepsExecuted,
          totalRetries,
          confidence: finalResult.data.confidence,
        },
      });

      return {
        analysis: finalResult.data,
        metadata: {
          totalDurationMs: totalDuration,
          stepsExecuted,
          retryCount: totalRetries,
          userContextUsed:
            (context.userContext?.patterns?.decisionCount ?? 0) > 0,
        },
        rawOutputs: {
          initial: initialResult.data,
          reflection: reflectionResult.data,
          final: finalResult.data,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'orchestration-langchain',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Legacy workflow execution (original implementation)
   * Kept for backward compatibility and A/B testing
   */
  private async executeLegacyWorkflow(
    context: OrchestrationContext,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = ['validation', 'user-context'];
    let totalRetries = 0;

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'orchestration',
    });

    try {
      // Step 2: Initial Analysis
      const initialResult = await this.runStep(
        'orchestration.initial-analysis',
        context.runId,
        () => this.executeInitialAnalysis(context),
      );
      if (!initialResult.success || !initialResult.data) {
        throw new Error(`Initial analysis failed: ${initialResult.error}`);
      }
      stepsExecuted.push('initial-analysis');
      totalRetries += initialResult.retryCount;

      // Step 3: Reflection
      const reflectionResult = await this.runStep(
        'orchestration.reflection',
        context.runId,
        () => this.executeReflection(context, initialResult.data),
      );
      if (!reflectionResult.success || !reflectionResult.data) {
        throw new Error(`Reflection failed: ${reflectionResult.error}`);
      }
      stepsExecuted.push('reflection');
      totalRetries += reflectionResult.retryCount;

      // Step 4: Final Synthesis
      const finalResult = await this.runStep(
        'orchestration.final-synthesis',
        context.runId,
        () =>
          this.executeFinalSynthesis(
            context,
            initialResult.data,
            reflectionResult.data,
          ),
      );
      if (!finalResult.success || !finalResult.data) {
        throw new Error(`Final synthesis failed: ${finalResult.error}`);
      }
      stepsExecuted.push('final-synthesis');
      totalRetries += finalResult.retryCount;

      const totalDuration = Date.now() - startTime;

      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'orchestration',
        durationMs: totalDuration,
        metadata: {
          stepsExecuted,
          totalRetries,
          confidence: finalResult.data.confidence,
        },
      });

      return {
        analysis: finalResult.data,
        metadata: {
          totalDurationMs: totalDuration,
          stepsExecuted,
          retryCount: totalRetries,
          userContextUsed:
            (context.userContext?.patterns?.decisionCount ?? 0) > 0,
        },
        rawOutputs: {
          initial: initialResult.data,
          reflection: reflectionResult.data,
          final: finalResult.data,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'orchestration',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Step 1: Initial Analysis (Deterministic)
   */
  private async executeInitialAnalysis(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'initial-analysis',
    });

    const prompts = this.promptBuilder.buildInitialAnalysisPrompt(
      context.input.situation,
      context.input.chosenDecision,
      context.input.personalReasoning,
      context.userContext,
    );

    const result = await this.llmClient.call({
      temperature: 0.3, // Deterministic
      maxTokens: 2000,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: InitialAnalysisSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'initial-analysis',
        durationMs,
        metadata: { retryCount: result.retryCount },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'initial-analysis',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * Step 2: Reflection (Creative)
   */
  private async executeReflection(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialAnalysis: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'reflection',
    });

    const prompts = this.promptBuilder.buildReflectionPrompt(
      initialAnalysis,
      context.input.situation,
      context.input.chosenDecision,
    );

    const result = await this.llmClient.call({
      temperature: 0.7, // Creative
      maxTokens: 1500,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: ReflectionSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'reflection',
        durationMs,
        metadata: { retryCount: result.retryCount },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'reflection',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * Step 3: Final Synthesis (Balanced)
   */
  private async executeFinalSynthesis(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialAnalysis: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reflection: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'final-synthesis',
    });

    const prompts = this.promptBuilder.buildFinalSynthesisPrompt(
      context.input.situation,
      context.input.chosenDecision,
      context.input.personalReasoning,
      initialAnalysis,
      reflection,
      context.userContext,
    );

    const result = await this.llmClient.call({
      temperature: 0.5, // Balanced
      maxTokens: 2500,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: FinalAnalysisSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'final-synthesis',
        durationMs,
        metadata: {
          retryCount: result.retryCount,
          confidence: (result.data as Record<string, unknown>)?.confidence,
        },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'final-synthesis',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * LangChain Step 1: Initial Analysis (Deterministic)
   */
  private async executeInitialAnalysisLangChain(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'initial-analysis-langchain',
    });

    const prompts = this.promptBuilder.buildInitialAnalysisPrompt(
      context.input.situation,
      context.input.chosenDecision,
      context.input.personalReasoning,
      context.userContext,
    );

    const result = await this.langChainClient.call({
      temperature: 0.3, // Deterministic
      maxTokens: 2000,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: InitialAnalysisSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'initial-analysis-langchain',
        durationMs,
        metadata: { retryCount: result.retryCount },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'initial-analysis-langchain',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * LangChain Step 2: Reflection (Creative)
   */
  private async executeReflectionLangChain(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialAnalysis: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'reflection-langchain',
    });

    const prompts = this.promptBuilder.buildReflectionPrompt(
      initialAnalysis,
      context.input.situation,
      context.input.chosenDecision,
    );

    const result = await this.langChainClient.call({
      temperature: 0.7, // Creative
      maxTokens: 1500,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: ReflectionSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'reflection-langchain',
        durationMs,
        metadata: { retryCount: result.retryCount },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'reflection-langchain',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * LangChain Step 3: Final Synthesis (Balanced)
   */
  private async executeFinalSynthesisLangChain(
    context: OrchestrationContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialAnalysis: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reflection: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<StepResult<any>> {
    const startTime = Date.now();

    this.logEvent({
      timestamp: new Date(),
      runId: context.runId,
      eventType: 'STEP_START',
      stepName: 'final-synthesis-langchain',
    });

    const prompts = this.promptBuilder.buildFinalSynthesisPrompt(
      context.input.situation,
      context.input.chosenDecision,
      context.input.personalReasoning,
      initialAnalysis,
      reflection,
      context.userContext,
    );

    const result = await this.langChainClient.call({
      temperature: 0.5, // Balanced
      maxTokens: 2500,
      responseFormat: 'json_object',
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      schema: FinalAnalysisSchema,
      retryable: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_COMPLETE',
        stepName: 'final-synthesis-langchain',
        durationMs,
        metadata: {
          retryCount: result.retryCount,
          confidence: (result.data as Record<string, unknown>)?.confidence,
        },
      });
    } else {
      this.logEvent({
        timestamp: new Date(),
        runId: context.runId,
        eventType: 'STEP_ERROR',
        stepName: 'final-synthesis-langchain',
        error: result.error,
        durationMs,
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      retryCount: result.retryCount,
      durationMs,
    };
  }

  /**
   * Wraps an orchestration step in an OTel span.
   * Records retry count, duration, and error status from the StepResult.
   */
  private async runStep<T>(
    spanName: string,
    runId: string,
    fn: () => Promise<StepResult<T>>,
  ): Promise<StepResult<T>> {
    return tracer.startActiveSpan(
      spanName,
      { attributes: { 'run.id': runId } },
      async (span) => {
        try {
          const result = await fn();
          span.setAttribute('llm.retry_count', result.retryCount);
          span.setAttribute('llm.duration_ms', result.durationMs);
          if (!result.success) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.error ?? 'step failed',
            });
          }
          return result;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Log telemetry event
   */
  private logEvent(event: TelemetryEvent): void {
    this.telemetryLogger(event);
  }

  /**
   * Default telemetry logger (console)
   */
  private defaultTelemetryLogger(event: TelemetryEvent): void {
    if (event.eventType === 'STEP_ERROR') {
      log.error({ stepName: event.stepName, err: event.error }, 'Step error');
    } else {
      log.info(
        {
          eventType: event.eventType,
          stepName: event.stepName,
          ...(event.metadata || {}),
        },
        'Step event',
      );
    }
  }
}
