import { z } from 'zod';
import { Category } from '@prisma/client';

// ============================================================================
// Zod Schemas for Structured Output Enforcement
// ============================================================================

export const CognitiveBiasSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const MissedAlternativeSchema = z.object({
  alternative: z.string().min(10).max(300),
  reasoning: z.string().min(10).max(500),
  feasibility: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const InsightSchema = z.object({
  type: z.enum(['STRENGTH', 'WEAKNESS', 'RECOMMENDATION', 'RISK']),
  content: z.string().min(10).max(500),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

// Step 1: Initial Analysis Output
export const InitialAnalysisSchema = z.object({
  category: z.nativeEnum(Category),
  cognitiveBiases: z.array(CognitiveBiasSchema).min(1).max(5),
  missedAlternatives: z.array(MissedAlternativeSchema).min(1).max(5),
  preliminaryInsights: z.array(z.string()).min(1).max(5),
});

// Step 2: Reflection Output
export const ReflectionSchema = z.object({
  analysisQuality: z.enum(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']),
  missingPerspectives: z.array(z.string()).max(3),
  additionalBiases: z.array(CognitiveBiasSchema).max(3),
  refinementSuggestions: z.array(z.string()).max(3),
});

// Step 3: Final Synthesis Output
export const FinalAnalysisSchema = z.object({
  category: z.nativeEnum(Category),
  cognitiveBiases: z.array(CognitiveBiasSchema).min(1).max(5),
  missedAlternatives: z.array(MissedAlternativeSchema).min(1).max(5),
  insights: z.array(InsightSchema).min(1).max(8),
  confidence: z.number().min(0).max(1),
});

// ============================================================================
// Input Validation
// ============================================================================

export const DecisionInputSchema = z.object({
  situation: z.string().min(20).max(5000),
  chosenDecision: z.string().min(10).max(2000),
  personalReasoning: z.string().min(10).max(2000).nullable(),
});

// ============================================================================
// User Context Types
// ============================================================================

export interface UserDecisionPattern {
  commonCategories: Category[];
  frequentBiases: string[];
  decisionCount: number;
  lastDecisionDate: Date | null;
}

export interface UserContext {
  userId: string;
  patterns: UserDecisionPattern;
  recentDecisions: Array<{
    category: Category;
    biases: string[];
    createdAt: Date;
  }>;
}

// ============================================================================
// Orchestration Types
// ============================================================================

export interface OrchestrationContext {
  input: z.infer<typeof DecisionInputSchema>;
  userContext: UserContext | null;
  runId: string;
  provider: string;
}

export interface StepResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryCount: number;
  durationMs: number;
}

export interface OrchestrationResult {
  analysis: z.infer<typeof FinalAnalysisSchema>;
  metadata: {
    totalDurationMs: number;
    stepsExecuted: string[];
    retryCount: number;
    userContextUsed: boolean;
  };
  rawOutputs: {
    initial?: unknown;
    reflection?: unknown;
    final?: unknown;
  };
}

// ============================================================================
// LLM Call Configuration
// ============================================================================

export interface LLMCallConfig {
  temperature: number;
  maxTokens: number;
  responseFormat: 'json_object' | 'text';
  systemPrompt: string;
  userPrompt: string;
  schema?: z.ZodSchema;
  retryable: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface LLMCallResult<T = unknown> {
  success: boolean;
  data?: T;
  rawResponse?: string;
  error?: string;
  retryCount: number;
  durationMs: number;
  tokensUsed?: number;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryEvent {
  timestamp: Date;
  runId: string;
  eventType:
    | 'STEP_START'
    | 'STEP_COMPLETE'
    | 'STEP_ERROR'
    | 'LLM_CALL'
    | 'RETRY'
    | 'VALIDATION_ERROR';
  stepName?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type TelemetryLogger = (event: TelemetryEvent) => void;
