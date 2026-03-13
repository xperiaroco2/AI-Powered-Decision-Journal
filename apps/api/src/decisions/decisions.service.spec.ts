import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DecisionsService } from './decisions.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateDecisionDto } from './dto/create-decision.dto';

describe('DecisionsService', () => {
  let service: DecisionsService;
  let prismaService: PrismaService;
  let queueService: QueueService;

  const mockPrismaService = {
    decision: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    decisionAnalysisRun: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockQueueService = {
    enqueueAnalysisRun: jest.fn(),
    enqueueDecisionEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<DecisionsService>(DecisionsService);
    prismaService = module.get<PrismaService>(PrismaService);
    queueService = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all decisions for a user', async () => {
      const userId = 'user-id-123';
      const mockDecisions = [
        {
          id: 'decision-1',
          userId,
          situation: 'Test situation 1',
          chosenDecision: 'Test decision 1',
          createdAt: new Date(),
          latestRun: {
            id: 'run-1',
            status: 'COMPLETED',
            categoryText: 'CAREER',
          },
        },
        {
          id: 'decision-2',
          userId,
          situation: 'Test situation 2',
          chosenDecision: 'Test decision 2',
          createdAt: new Date(),
          latestRun: null,
        },
      ];

      mockPrismaService.decision.findMany.mockResolvedValue(mockDecisions);

      const result = await service.findAll(userId);

      expect(prismaService.decision.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          latestRun: {
            select: {
              id: true,
              status: true,
              categoryText: true,
            },
          },
        },
      });
      expect(result).toEqual(mockDecisions);
    });
  });

  describe('findOne', () => {
    const userId = 'user-id-123';
    const decisionId = 'decision-id-123';

    it('should return a decision with all runs', async () => {
      const mockDecision = {
        id: decisionId,
        userId,
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        latestRun: { id: 'run-1', status: 'COMPLETED' },
        runs: [
          { id: 'run-1', status: 'COMPLETED', createdAt: new Date() },
          { id: 'run-2', status: 'FAILED', createdAt: new Date() },
        ],
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);

      const result = await service.findOne(decisionId, userId);

      expect(prismaService.decision.findUnique).toHaveBeenCalledWith({
        where: { id: decisionId },
        include: {
          latestRun: true,
          runs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      expect(result).toEqual(mockDecision);
    });

    it('should throw NotFoundException if decision does not exist', async () => {
      mockPrismaService.decision.findUnique.mockResolvedValue(null);

      await expect(service.findOne(decisionId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if decision belongs to different user', async () => {
      const mockDecision = {
        id: decisionId,
        userId: 'different-user-id',
        situation: 'Test situation',
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);

      await expect(service.findOne(decisionId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const userId = 'user-id-123';
    const createDecisionDto: CreateDecisionDto = {
      situation: 'Should I change careers?',
      chosenDecision: 'Yes, I will change careers',
      personalReasoning: 'I want better work-life balance',
    };

    it('should create a decision with initial run and enqueue jobs', async () => {
      const mockDecision = {
        id: 'decision-id-123',
        userId,
        ...createDecisionDto,
        status: 'PENDING',
        createdAt: new Date(),
      };

      const mockRun = {
        id: 'run-id-123',
        decisionId: mockDecision.id,
        status: 'PENDING',
        provider: 'mock',
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          decision: {
            create: jest.fn().mockResolvedValue(mockDecision),
            update: jest.fn(),
          },
          decisionAnalysisRun: {
            create: jest.fn().mockResolvedValue(mockRun),
          },
        });
      });

      mockQueueService.enqueueAnalysisRun.mockResolvedValue(undefined);
      mockQueueService.enqueueDecisionEmbedding.mockResolvedValue(undefined);

      const result = await service.create(userId, createDecisionDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(queueService.enqueueAnalysisRun).toHaveBeenCalledWith(mockRun.id);
      expect(queueService.enqueueDecisionEmbedding).toHaveBeenCalledWith(
        mockDecision.id,
      );
      expect(result).toEqual(mockDecision);
    });

    it('should create decision without personalReasoning', async () => {
      const dtoWithoutReasoning: CreateDecisionDto = {
        situation: 'Should I change careers?',
        chosenDecision: 'Yes, I will change careers',
      };

      const mockDecision = {
        id: 'decision-id-123',
        userId,
        situation: dtoWithoutReasoning.situation,
        chosenDecision: dtoWithoutReasoning.chosenDecision,
        personalReasoning: null,
        status: 'PENDING',
      };

      const mockRun = {
        id: 'run-id-123',
        decisionId: mockDecision.id,
        status: 'PENDING',
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          decision: {
            create: jest.fn().mockResolvedValue(mockDecision),
            update: jest.fn(),
          },
          decisionAnalysisRun: {
            create: jest.fn().mockResolvedValue(mockRun),
          },
        });
      });

      mockQueueService.enqueueAnalysisRun.mockResolvedValue(undefined);
      mockQueueService.enqueueDecisionEmbedding.mockResolvedValue(undefined);

      const result = await service.create(userId, dtoWithoutReasoning);

      expect(result.personalReasoning).toBeNull();
    });

    it('should not fail if queue enqueue fails', async () => {
      const mockDecision = {
        id: 'decision-id-123',
        userId,
        ...createDecisionDto,
        status: 'PENDING',
      };

      const mockRun = {
        id: 'run-id-123',
        decisionId: mockDecision.id,
        status: 'PENDING',
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          decision: {
            create: jest.fn().mockResolvedValue(mockDecision),
            update: jest.fn(),
          },
          decisionAnalysisRun: {
            create: jest.fn().mockResolvedValue(mockRun),
          },
        });
      });

      // Simulate queue failure
      mockQueueService.enqueueAnalysisRun.mockRejectedValue(
        new Error('Queue error'),
      );
      mockQueueService.enqueueDecisionEmbedding.mockRejectedValue(
        new Error('Queue error'),
      );

      // Should not throw
      const result = await service.create(userId, createDecisionDto);
      expect(result).toEqual(mockDecision);
    });
  });

  describe('rerun', () => {
    const userId = 'user-id-123';
    const decisionId = 'decision-id-123';

    it('should create a new analysis run for existing decision', async () => {
      const mockDecision = {
        id: decisionId,
        userId,
        situation: 'Test situation',
        runs: [], // No processing runs
      };

      const mockRun = {
        id: 'new-run-id',
        decisionId,
        status: 'PENDING',
        provider: 'mock',
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          decisionAnalysisRun: {
            create: jest.fn().mockResolvedValue(mockRun),
          },
          decision: {
            update: jest.fn(),
          },
        });
      });
      mockQueueService.enqueueAnalysisRun.mockResolvedValue(undefined);

      const result = await service.rerun(decisionId, userId);

      expect(prismaService.decision.findUnique).toHaveBeenCalledWith({
        where: { id: decisionId },
        include: {
          runs: {
            where: { status: 'PROCESSING' },
            take: 1,
          },
        },
      });
      expect(queueService.enqueueAnalysisRun).toHaveBeenCalledWith(mockRun.id);
      expect(result).toEqual({
        message: 'Analysis rerun initiated',
        runId: mockRun.id,
        status: 'PENDING',
      });
    });

    it('should throw NotFoundException if decision does not exist', async () => {
      mockPrismaService.decision.findUnique.mockResolvedValue(null);

      await expect(service.rerun(decisionId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own decision', async () => {
      const mockDecision = {
        id: decisionId,
        userId: 'different-user-id',
        runs: [],
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);

      await expect(service.rerun(decisionId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if analysis is already in progress', async () => {
      const mockDecision = {
        id: decisionId,
        userId,
        runs: [{ id: 'processing-run', status: 'PROCESSING' }],
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);

      await expect(service.rerun(decisionId, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw error if queue enqueue fails', async () => {
      const mockDecision = {
        id: decisionId,
        userId,
        runs: [],
      };

      const mockRun = {
        id: 'new-run-id',
        decisionId,
        status: 'PENDING',
      };

      mockPrismaService.decision.findUnique.mockResolvedValue(mockDecision);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          decisionAnalysisRun: {
            create: jest.fn().mockResolvedValue(mockRun),
          },
          decision: {
            update: jest.fn(),
          },
        });
      });
      mockQueueService.enqueueAnalysisRun.mockRejectedValue(
        new Error('Queue error'),
      );

      await expect(service.rerun(decisionId, userId)).rejects.toThrow(
        'Failed to enqueue analysis',
      );
    });
  });
});
