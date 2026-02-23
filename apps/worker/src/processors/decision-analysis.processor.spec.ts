/**
 * Decision Analysis Processor Unit Tests
 *
 * Tests the core business logic for processing decision analysis jobs.
 */

// Module-level mock functions that will be accessible in tests
let mockFindUnique: jest.Mock;
let mockUpdateRun: jest.Mock;
let mockUpdateDecision: jest.Mock;

// Mock dependencies BEFORE imports
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      decisionAnalysisRun: {
        get findUnique() { return mockFindUnique; },
        get update() { return mockUpdateRun; },
      },
      decision: {
        get update() { return mockUpdateDecision; },
      },
    })),
    Category: {
      CAREER: 'CAREER',
      FINANCIAL: 'FINANCIAL',
      RELATIONSHIPS: 'RELATIONSHIPS',
      HEALTH: 'HEALTH',
      EDUCATION: 'EDUCATION',
      BUSINESS: 'BUSINESS',
      LIFESTYLE: 'LIFESTYLE',
      ETHICAL: 'ETHICAL',
      CREATIVE: 'CREATIVE',
      TECHNICAL: 'TECHNICAL',
      OTHER: 'OTHER',
    },
  };
});
jest.mock('../services/ai.service');
jest.mock('../services/event-publisher');
jest.mock('../services/providers/groq.provider');

import { processDecisionAnalysis } from './decision-analysis.processor';
import { PrismaClient } from '@prisma/client';
import { getAIProvider } from '../services/ai.service';
import { publishRunUpdate } from '../services/event-publisher';
import { GroqProvider } from '../services/providers/groq.provider';

describe('Decision Analysis Processor', () => {
  let mockProvider: any;
  let mockJob: any;

  beforeEach(() => {
    // Reset mock functions
    mockFindUnique = jest.fn();
    mockUpdateRun = jest.fn();
    mockUpdateDecision = jest.fn();

    // Create mock AI provider
    mockProvider = {
      analyze: jest.fn(),
      setContext: jest.fn(),
    };

    (getAIProvider as jest.Mock).mockReturnValue(mockProvider);
    (publishRunUpdate as jest.Mock).mockResolvedValue(undefined);

    // Create mock job
    mockJob = {
      id: 'job-123',
      data: {
        runId: 'run-456',
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful processing', () => {
    it('should process decision analysis successfully', async () => {
      // Setup mock data
      const mockRun = {
        id: 'run-456',
        decisionId: 'decision-789',
        provider: 'mock',
        status: 'PENDING',
        decision: {
          id: 'decision-789',
          userId: 'user-123',
          situation: 'Should I switch jobs?',
          chosenDecision: 'Yes',
          personalReasoning: 'Better salary',
        },
      };

      const mockAnalysisResult = {
        category: 'CAREER',
        cognitiveBiases: [{ name: 'Anchoring', description: 'Test' }],
        missedAlternatives: ['Stay and negotiate'],
        insights: ['Good reasoning'],
        rawAiResponse: '{"test": "data"}',
      };

      mockFindUnique.mockResolvedValue(mockRun as any);
      mockUpdateRun.mockResolvedValue({} as any);
      mockUpdateDecision.mockResolvedValue({} as any);
      mockProvider.analyze.mockResolvedValue(mockAnalysisResult);

      // Execute
      await processDecisionAnalysis(mockJob);

      // Verify run was fetched
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        include: { decision: true },
      });

      // Verify status updated to PROCESSING
      expect(mockUpdateRun).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          status: 'PROCESSING',
          startedAt: expect.any(Date),
        },
      });

      // Verify decision status updated to PROCESSING
      expect(mockUpdateDecision).toHaveBeenCalledWith({
        where: { id: 'decision-789' },
        data: { status: 'PROCESSING' },
      });

      // Verify PROCESSING event published
      expect(publishRunUpdate).toHaveBeenCalledWith(
        'decision-789',
        'run-456',
        'PROCESSING',
      );

      // Verify AI provider called
      expect(mockProvider.analyze).toHaveBeenCalledWith({
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes',
        personalReasoning: 'Better salary',
      });

      // Verify run updated with results
      expect(mockUpdateRun).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          status: 'COMPLETED',
          resultJson: expect.objectContaining({
            category: 'CAREER',
            cognitiveBiases: expect.any(Array),
            missedAlternatives: expect.any(Array),
            insights: expect.any(Array),
          }),
          categoryText: 'CAREER',
          biasesText: ['Anchoring'],
          finishedAt: expect.any(Date),
        },
      });

      // Verify decision status updated to DONE
      expect(mockUpdateDecision).toHaveBeenCalledWith({
        where: { id: 'decision-789' },
        data: {
          status: 'DONE',
          latestRunId: 'run-456',
        },
      });

      // Verify COMPLETED event published
      expect(publishRunUpdate).toHaveBeenCalledWith(
        'decision-789',
        'run-456',
        'COMPLETED',
      );
    });

    it('should set context for Groq provider', async () => {
      const mockRun = {
        id: 'run-456',
        decisionId: 'decision-789',
        provider: 'groq',
        decision: {
          id: 'decision-789',
          userId: 'user-123',
          situation: 'Test',
          chosenDecision: 'Test',
          personalReasoning: null,
        },
      };

      mockFindUnique.mockResolvedValue(mockRun as any);
      mockUpdateRun.mockResolvedValue({} as any);
      mockUpdateDecision.mockResolvedValue({} as any);

      // Make provider an instance of GroqProvider
      Object.setPrototypeOf(mockProvider, GroqProvider.prototype);

      mockProvider.analyze.mockResolvedValue({
        category: 'OTHER',
        cognitiveBiases: [],
        missedAlternatives: [],
        insights: [],
        rawAiResponse: '{}',
      });

      await processDecisionAnalysis(mockJob);

      expect(mockProvider.setContext).toHaveBeenCalledWith('user-123', 'run-456');
    });
  });

  describe('error handling', () => {
    it('should throw error if run not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(processDecisionAnalysis(mockJob)).rejects.toThrow(
        'Run run-456 not found',
      );
    });

    it('should handle AI provider errors and update run status to FAILED', async () => {
      const mockRun = {
        id: 'run-456',
        decisionId: 'decision-789',
        provider: 'mock',
        decision: {
          id: 'decision-789',
          userId: 'user-123',
          situation: 'Test',
          chosenDecision: 'Test',
          personalReasoning: null,
        },
      };

      mockFindUnique.mockResolvedValue(mockRun as any);
      mockUpdateRun.mockResolvedValue({} as any);
      mockUpdateDecision.mockResolvedValue({} as any);
      mockProvider.analyze.mockRejectedValue(new Error('AI API error'));

      await expect(processDecisionAnalysis(mockJob)).rejects.toThrow('AI API error');

      // Verify run status updated to FAILED
      expect(mockUpdateRun).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          status: 'FAILED',
          error: 'AI API error',
          finishedAt: expect.any(Date),
        },
      });

      // Verify decision status updated to FAILED
      expect(mockUpdateDecision).toHaveBeenCalledWith({
        where: { id: 'decision-789' },
        data: {
          status: 'FAILED',
          latestRunId: 'run-456',
        },
      });

      // Verify FAILED event published
      expect(publishRunUpdate).toHaveBeenCalledWith(
        'decision-789',
        'run-456',
        'FAILED',
      );
    });
  });
});

