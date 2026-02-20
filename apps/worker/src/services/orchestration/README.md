# Production AI Orchestration System

This directory contains the production-grade LLM orchestration system for decision analysis.

## Quick Start

### 1. Set Environment Variables

```bash
# Use production orchestration
AI_PROVIDER=groq

# Groq API key
GROQ_API_KEY=your_key_here
```

### 2. Run the Worker

```bash
cd apps/worker
pnpm dev
```

### 3. Create a Decision

The orchestration system will automatically run when a decision is created via the API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator                              │
│  - Coordinates multi-step workflow                          │
│  - Manages telemetry and error handling                     │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Input        │  │ User Context │  │ LLM Client   │
│ Validator    │  │ Manager      │  │              │
│              │  │              │  │ - Retry      │
│ - Semantic   │  │ - Pattern    │  │ - Timeout    │
│   validation │  │   extraction │  │ - Validation │
│ - Quality    │  │ - Prompt     │  │              │
│   scoring    │  │   injection  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ Groq API     │
                                    └──────────────┘
```

## Components

### 1. `orchestrator.ts` - Main Workflow Engine

Coordinates the 3-step analysis workflow:

**Step 1: Initial Analysis (temp=0.3)**
- Deterministic category classification
- Cognitive bias detection
- Missed alternatives identification

**Step 2: Reflection (temp=0.7)**
- Meta-analysis of initial output
- Blind spot identification
- Quality assessment

**Step 3: Final Synthesis (temp=0.5)**
- Incorporates reflection feedback
- Produces refined output
- Includes confidence score

### 2. `llm-client.ts` - LLM API Wrapper

Handles all LLM calls with:
- **Exponential backoff retry** (1s → 2s → 4s → 8s)
- **Error classification** (retryable vs non-retryable)
- **Timeout enforcement** (30s default)
- **Schema validation** (Zod)

### 3. `input-validator.ts` - Semantic Validation

Validates input quality beyond schema:
- Word count minimums
- Gibberish detection
- Spam detection
- Quality scoring (LOW/MEDIUM/HIGH)

### 4. `user-context.ts` - Lightweight Memory

Builds user context from decision history:
- Last 10 decisions
- Common categories (top 3)
- Recurring biases (top 5)
- No vector DB required

### 5. `prompts.ts` - Prompt Templates

Centralized prompt management:
- Separate prompts for each step
- User context injection
- Temperature-appropriate instructions

### 6. `types.ts` - Type Definitions

Zod schemas for structured output:
- `InitialAnalysisSchema`
- `ReflectionSchema`
- `FinalAnalysisSchema`
- Telemetry types

## Usage Example

```typescript
import { DecisionAnalysisOrchestrator } from './orchestrator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const orchestrator = new DecisionAnalysisOrchestrator(
  process.env.GROQ_API_KEY!,
  prisma
);

const result = await orchestrator.execute(
  {
    situation: "I'm considering a job offer...",
    chosenDecision: "I decided to accept the offer",
    personalReasoning: "The salary is 20% higher..."
  },
  userId,
  runId
);

console.log(result.analysis);
// {
//   category: "CAREER",
//   cognitiveBiases: [...],
//   missedAlternatives: [...],
//   insights: [...],
//   confidence: 0.85
// }
```

## Key Features

### ✅ Multi-Step Workflow
3-step process with analyze → reflect → synthesize

### ✅ Retry Logic
Exponential backoff with jitter, max 3 retries per step

### ✅ Structured Output
Zod schema validation with automatic retry on validation failure

### ✅ User Context
Lightweight memory system with pattern extraction

### ✅ Observability
Comprehensive telemetry with step timing and retry counts

### ✅ Error Handling
Clear error classification and fail-fast behavior

## Configuration

### Temperature Settings

```typescript
// Step 1: Deterministic
temperature: 0.3

// Step 2: Creative
temperature: 0.7

// Step 3: Balanced
temperature: 0.5
```

### Retry Configuration

```typescript
{
  retryable: true,
  maxRetries: 3,
  timeoutMs: 30000
}
```

### Validation

```typescript
{
  schema: InitialAnalysisSchema,  // Zod schema
  responseFormat: "json_object"   // Groq JSON mode
}
```

## Telemetry Events

The orchestrator emits telemetry events:

```typescript
{
  timestamp: Date,
  runId: string,
  eventType: "STEP_START" | "STEP_COMPLETE" | "STEP_ERROR" | "LLM_CALL" | "RETRY",
  stepName: string,
  durationMs?: number,
  error?: string,
  metadata?: Record<string, any>
}
```

Example output:
```
[2026-02-10T12:00:00Z][run_123][STEP_START] Starting: initial-analysis
[2026-02-10T12:00:02Z][run_123][STEP_COMPLETE] Completed: initial-analysis (2000ms) { retryCount: 0 }
[2026-02-10T12:00:02Z][run_123][STEP_START] Starting: reflection
[2026-02-10T12:00:04Z][run_123][STEP_COMPLETE] Completed: reflection (1500ms) { retryCount: 0 }
[2026-02-10T12:00:04Z][run_123][STEP_START] Starting: final-synthesis
[2026-02-10T12:00:07Z][run_123][STEP_COMPLETE] Completed: final-synthesis (3000ms) { retryCount: 0, confidence: 0.85 }
```

## Error Handling

### Retryable Errors
- Network timeouts
- Rate limits (429)
- Server errors (5xx)

### Non-Retryable Errors
- Validation failures
- Auth errors (401, 403)
- Malformed input

### Example Error Flow

```
1. LLM call fails with timeout
2. Classify error as retryable
3. Wait 1 second (exponential backoff)
4. Retry LLM call
5. If still fails, wait 2 seconds
6. Retry again
7. If fails after 3 retries, throw error
```

## Performance

**Typical execution:**
- Input validation: <10ms
- User context loading: 50-100ms
- Step 1: 1-3s
- Step 2: 1-2s
- Step 3: 2-4s
- **Total: 4-10 seconds**

**With retries (worst case):**
- 3 retries × 3 steps = 9 retries
- With exponential backoff: ~30-60 seconds max

## Testing

### Unit Tests

```typescript
// Mock LLMClient
const mockClient = {
  call: jest.fn().mockResolvedValue({
    success: true,
    data: { category: "CAREER", ... }
  })
};

// Test orchestrator
const orchestrator = new DecisionAnalysisOrchestrator(
  apiKey,
  prisma,
  mockClient
);
```

### Integration Tests

```typescript
// Use mock provider
process.env.AI_PROVIDER = 'mock';

// Test full workflow
const result = await orchestrator.execute(input, userId, runId);
expect(result.analysis.category).toBeDefined();
```

## Future Enhancements

1. **Caching** - Cache user context in Redis (TTL: 5 min)
2. **Streaming** - Stream partial results to frontend
3. **Fallback Models** - If Groq fails, fallback to OpenAI
4. **Prompt Versioning** - Track prompt changes and A/B test
5. **Cost Tracking** - Log token usage per user

## Documentation

- [Production Architecture](../../../../../docs/PRODUCTION_AI_ARCHITECTURE.md)
- [Example Prompts](../../../../../docs/EXAMPLE_PROMPTS.md)
- [Interview Guide](../../../../../docs/INTERVIEW_GUIDE.md)

## License

MIT

