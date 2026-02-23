/**
 * Decision Embedding Processor Unit Tests
 *
 * Tests the core business logic for generating decision embeddings.
 */

// Module-level mock functions that will be accessible in tests
let mockFindUniqueDecision: jest.Mock;
let mockFindUniqueEmbedding: jest.Mock;
let mockExecuteRaw: jest.Mock;

// Mock dependencies BEFORE imports
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      decision: {
        get findUnique() { return mockFindUniqueDecision; },
      },
      decisionEmbedding: {
        get findUnique() { return mockFindUniqueEmbedding; },
      },
      get $executeRaw() { return mockExecuteRaw; },
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
jest.mock('../services/embedding.service');

import { processDecisionEmbedding } from './decision-embedding.processor';
import { PrismaClient } from '@prisma/client';
import { getEmbeddingProvider, prepareDecisionTextForEmbedding } from '../services/embedding.service';

describe('Decision Embedding Processor', () => {
  let mockProvider: any;
  let mockJob: any;

  beforeEach(() => {
    // Reset mock functions
    mockFindUniqueDecision = jest.fn();
    mockFindUniqueEmbedding = jest.fn();
    mockExecuteRaw = jest.fn();

    // Create mock embedding provider
    mockProvider = {
      generateEmbedding: jest.fn(),
    };

    (getEmbeddingProvider as jest.Mock).mockReturnValue(mockProvider);
    (prepareDecisionTextForEmbedding as jest.Mock).mockReturnValue('Prepared text for embedding');

    // Create mock job
    mockJob = {
      id: 'job-123',
      data: {
        decisionId: 'decision-456',
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful processing', () => {
    it('should generate and store embedding for new decision', async () => {
      const mockDecision = {
        id: 'decision-456',
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes',
        personalReasoning: 'Better salary',
      };

      const mockEmbedding = new Array(1536).fill(0.5);

      mockFindUniqueDecision.mockResolvedValue(mockDecision as any);
      mockFindUniqueEmbedding.mockResolvedValue(null);
      mockProvider.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockExecuteRaw.mockResolvedValue(1);

      await processDecisionEmbedding(mockJob);

      // Verify decision was fetched
      expect(mockFindUniqueDecision).toHaveBeenCalledWith({
        where: { id: 'decision-456' },
        select: {
          id: true,
          situation: true,
          chosenDecision: true,
          personalReasoning: true,
        },
      });

      // Verify text was prepared
      expect(prepareDecisionTextForEmbedding).toHaveBeenCalledWith(mockDecision);

      // Verify embedding was generated
      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('Prepared text for embedding');

      // Verify embedding was inserted
      expect(mockExecuteRaw).toHaveBeenCalled();
      const insertCall = mockExecuteRaw.mock.calls[0];
      expect(insertCall[0].join('')).toContain('INSERT INTO "DecisionEmbedding"');
      expect(insertCall[0].join('')).toContain('COMPLETED');
    });

    it('should update existing embedding', async () => {
      const mockDecision = {
        id: 'decision-456',
        situation: 'Test',
        chosenDecision: 'Test',
        personalReasoning: null,
      };

      const mockExistingEmbedding = {
        id: 'embedding-123',
        decisionId: 'decision-456',
        status: 'COMPLETED',
      };

      const mockEmbedding = new Array(1536).fill(0.5);

      mockFindUniqueDecision.mockResolvedValue(mockDecision as any);
      mockFindUniqueEmbedding.mockResolvedValue(mockExistingEmbedding as any);
      mockProvider.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockExecuteRaw.mockResolvedValue(1);

      await processDecisionEmbedding(mockJob);

      // Verify embedding was updated
      expect(mockExecuteRaw).toHaveBeenCalled();
      const updateCall = mockExecuteRaw.mock.calls[0];
      expect(updateCall[0].join('')).toContain('UPDATE "DecisionEmbedding"');
      expect(updateCall[0].join('')).toContain('COMPLETED');
    });
  });

  describe('error handling', () => {
    it('should throw error if decision not found', async () => {
      mockFindUniqueDecision.mockResolvedValue(null);

      await expect(processDecisionEmbedding(mockJob)).rejects.toThrow(
        'Decision decision-456 not found',
      );
    });

    it('should throw error if prepared text is empty', async () => {
      const mockDecision = {
        id: 'decision-456',
        situation: '',
        chosenDecision: '',
        personalReasoning: null,
      };

      mockFindUniqueDecision.mockResolvedValue(mockDecision as any);
      (prepareDecisionTextForEmbedding as jest.Mock).mockReturnValue('');

      await expect(processDecisionEmbedding(mockJob)).rejects.toThrow(
        'Cannot generate embedding for empty decision text',
      );
    });

    it('should handle embedding generation errors and update status to FAILED', async () => {
      const mockDecision = {
        id: 'decision-456',
        situation: 'Test',
        chosenDecision: 'Test',
        personalReasoning: null,
      };

      mockFindUniqueDecision.mockResolvedValue(mockDecision as any);
      mockFindUniqueEmbedding.mockResolvedValue(null);
      mockProvider.generateEmbedding.mockRejectedValue(new Error('API error'));
      mockExecuteRaw.mockResolvedValue(1);

      await expect(processDecisionEmbedding(mockJob)).rejects.toThrow('API error');

      // Verify FAILED status was inserted
      expect(mockExecuteRaw).toHaveBeenCalled();
      const failedCall = mockExecuteRaw.mock.calls[0];
      expect(failedCall[0].join('')).toContain('INSERT INTO "DecisionEmbedding"');
      expect(failedCall[0].join('')).toContain('FAILED');
    });
  });
});

