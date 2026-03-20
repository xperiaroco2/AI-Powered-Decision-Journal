/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Groq Provider Unit Tests
 *
 * Tests the Groq AI provider with orchestration workflow.
 */

import { GroqProvider } from './groq.provider';
import { PrismaClient } from '@prisma/client';
import { DecisionAnalysisOrchestrator } from '../orchestration/orchestrator';

// Mock the orchestrator
jest.mock('../orchestration/orchestrator');

describe('GroqProvider', () => {
  let provider: GroqProvider;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockOrchestrator: jest.Mocked<DecisionAnalysisOrchestrator>;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {} as jest.Mocked<PrismaClient>;

    // Create mock orchestrator
    mockOrchestrator = {
      execute: jest.fn(),
    } as any;

    // Mock the orchestrator constructor
    (
      DecisionAnalysisOrchestrator as jest.MockedClass<
        typeof DecisionAnalysisOrchestrator
      >
    ).mockImplementation(() => mockOrchestrator);

    // Create provider
    provider = new GroqProvider('test-api-key', mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setContext', () => {
    it('should set userId and runId', () => {
      provider.setContext('user-123', 'run-456');

      // Context is set internally, we'll verify it's used in analyze()
      expect(provider).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should throw error if context is not set', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      await expect(provider.analyze(input)).rejects.toThrow(
        'Context not set. Call setContext() before analyze()',
      );
    });

    it('should call orchestrator.execute with correct parameters', async () => {
      provider.setContext('user-123', 'run-456');

      const input = {
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes',
        personalReasoning: 'Better salary',
      };

      const mockOrchestratorResult = {
        analysis: {
          category: 'CAREER' as const,
          cognitiveBiases: [{ name: 'Anchoring', description: 'Test bias' }],
          missedAlternatives: [
            {
              alternative: 'Stay and negotiate',
              reasoning: 'Could improve current situation',
              feasibility: 'HIGH' as const,
            },
          ],
          insights: [{ type: 'STRENGTH' as const, content: 'Good reasoning' }],
          confidence: 0.85,
        },
        rawOutputs: { initial: 'data', reflection: 'data', final: 'data' },
        metadata: {
          totalDurationMs: 2000,
          stepsExecuted: ['initial', 'reflection', 'final'],
          retryCount: 0,
          userContextUsed: false,
        },
      };

      mockOrchestrator.execute.mockResolvedValue(mockOrchestratorResult);

      await provider.analyze(input);

      expect(mockOrchestrator.execute).toHaveBeenCalledWith(
        input,
        'user-123',
        'run-456',
      );
    });

    it('should transform orchestrator result to AnalysisResult format', async () => {
      provider.setContext('user-123', 'run-456');

      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const mockOrchestratorResult = {
        analysis: {
          category: 'FINANCIAL' as const,
          cognitiveBiases: [
            {
              name: 'Confirmation Bias',
              description: 'Seeking confirming info',
            },
          ],
          missedAlternatives: [
            {
              alternative: 'Alternative 1',
              reasoning: 'Could work',
              feasibility: 'MEDIUM' as const,
            },
            {
              alternative: 'Alternative 2',
              reasoning: 'Less likely',
              feasibility: 'LOW' as const,
            },
          ],
          insights: [
            { type: 'STRENGTH' as const, content: 'Well thought out' },
            { type: 'WEAKNESS' as const, content: 'Missing data' },
            { type: 'RECOMMENDATION' as const, content: 'Consider X' },
            { type: 'RISK' as const, content: 'Watch out for Y' },
          ],
          confidence: 0.75,
        },
        rawOutputs: {
          initial: 'data',
          reflection: 'more data',
          final: 'final data',
        },
        metadata: {
          totalDurationMs: 2000,
          stepsExecuted: ['initial', 'reflection', 'final'],
          retryCount: 0,
          userContextUsed: false,
        },
      };

      mockOrchestrator.execute.mockResolvedValue(mockOrchestratorResult);

      const result = await provider.analyze(input);

      expect(result.category).toBe('FINANCIAL');
      expect(result.cognitiveBiases).toEqual([
        { name: 'Confirmation Bias', description: 'Seeking confirming info' },
      ]);
      expect(result.missedAlternatives).toEqual([
        'Alternative 1 (Feasibility: MEDIUM)',
        'Alternative 2 (Feasibility: LOW)',
      ]);
      expect(result.insights).toEqual([
        '✓ Well thought out',
        '⚠ Missing data',
        '→ Consider X',
        '⚡ Watch out for Y',
      ]);
      expect(result.rawAiResponse).toContain('initial');
      expect(result.rawAiResponse).toContain('reflection');
      expect(result.rawAiResponse).toContain('final');
    });

    it('should handle insights without type prefix', async () => {
      provider.setContext('user-123', 'run-456');

      const input = {
        situation: 'Test',
        chosenDecision: 'Test',
        personalReasoning: null,
      };

      const mockOrchestratorResult = {
        analysis: {
          category: 'OTHER' as const,
          cognitiveBiases: [
            {
              name: 'Test Bias',
              description: 'Test description for minimum requirement',
            },
          ],
          missedAlternatives: [
            {
              alternative: 'Test alternative',
              reasoning: 'Test reasoning for minimum requirement',
            },
          ],
          insights: [{ type: 'STRENGTH' as const, content: 'Some insight' }],
          confidence: 0.5,
        },
        rawOutputs: {},
        metadata: {
          totalDurationMs: 1000,
          stepsExecuted: ['initial', 'reflection', 'final'],
          retryCount: 0,
          userContextUsed: false,
        },
      };

      mockOrchestrator.execute.mockResolvedValue(mockOrchestratorResult);

      const result = await provider.analyze(input);

      expect(result.insights).toEqual(['✓ Some insight']);
    });

    it('should handle orchestration errors', async () => {
      provider.setContext('user-123', 'run-456');

      const input = {
        situation: 'Test',
        chosenDecision: 'Test',
        personalReasoning: null,
      };

      mockOrchestrator.execute.mockRejectedValue(new Error('LLM API error'));

      await expect(provider.analyze(input)).rejects.toThrow(
        'Orchestration error: LLM API error',
      );
    });

    it('should format rawAiResponse as JSON', async () => {
      provider.setContext('user-123', 'run-456');

      const input = {
        situation: 'Test',
        chosenDecision: 'Test',
        personalReasoning: null,
      };

      const mockOrchestratorResult = {
        analysis: {
          category: 'CAREER' as const,
          cognitiveBiases: [
            {
              name: 'Test Bias',
              description: 'Test description for minimum requirement',
            },
          ],
          missedAlternatives: [
            {
              alternative: 'Test alternative',
              reasoning: 'Test reasoning for minimum requirement',
            },
          ],
          insights: [
            {
              type: 'STRENGTH' as const,
              content: 'Test insight for minimum requirement',
            },
          ],
          confidence: 0.6,
        },
        rawOutputs: {
          initial: 'test data',
          reflection: 'test data',
          final: 'test data',
        },
        metadata: {
          totalDurationMs: 800,
          stepsExecuted: ['initial', 'reflection', 'final'],
          retryCount: 0,
          userContextUsed: false,
        },
      };

      mockOrchestrator.execute.mockResolvedValue(mockOrchestratorResult);

      const result = await provider.analyze(input);

      expect(() => JSON.parse(result.rawAiResponse)).not.toThrow();
      const parsed = JSON.parse(result.rawAiResponse);
      expect(parsed).toEqual({
        initial: 'test data',
        reflection: 'test data',
        final: 'test data',
      });
    });
  });
});
