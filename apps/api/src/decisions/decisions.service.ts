import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateDecisionDto } from './dto/create-decision.dto';

/**
 * Decisions Service
 *
 * Handles decision CRUD operations and analysis reruns.
 * Migrated from:
 * - apps/web/app/api/decisions/route.ts
 * - apps/web/app/api/decisions/[id]/route.ts
 * - apps/web/app/api/decisions/[id]/rerun/route.ts
 */
@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get all decisions for user
   * From: GET /api/decisions
   */
  async findAll(userId: string) {
    return this.prisma.decision.findMany({
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
  }

  /**
   * Get single decision with all runs
   * From: GET /api/decisions/[id]
   */
  async findOne(id: string, userId: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: {
        latestRun: true,
        runs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    if (decision.userId !== userId) {
      throw new ForbiddenException("You don't have access to this decision");
    }

    return decision;
  }

  /**
   * Create new decision with initial analysis run
   * From: POST /api/decisions
   */
  async create(userId: string, createDecisionDto: CreateDecisionDto) {
    const { situation, chosenDecision, personalReasoning } = createDecisionDto;

    // Get AI provider from environment (default to mock)
    const aiProvider = process.env.AI_PROVIDER || 'mock';

    // Create decision and initial analysis run in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create decision
      const decision = await tx.decision.create({
        data: {
          userId,
          situation,
          chosenDecision,
          personalReasoning: personalReasoning || null,
          status: 'PENDING',
        },
      });

      // 2. Create initial analysis run
      const run = await tx.decisionAnalysisRun.create({
        data: {
          decisionId: decision.id,
          status: 'PENDING',
          provider: aiProvider,
        },
      });

      // 3. Update decision to point to this run
      await tx.decision.update({
        where: { id: decision.id },
        data: { latestRunId: run.id },
      });

      return { decision, run };
    });

    // Enqueue run for background analysis
    try {
      await this.queueService.enqueueAnalysisRun(result.run.id);
    } catch (queueError) {
      console.error('Failed to enqueue run for analysis:', queueError);
      // Don't fail the request if queueing fails - decision is still created
    }

    // Enqueue decision for embedding generation (RAG advisory feature)
    try {
      await this.queueService.enqueueDecisionEmbedding(result.decision.id);
    } catch (queueError) {
      console.error('Failed to enqueue decision for embedding:', queueError);
      // Don't fail the request if queueing fails - embedding is optional
    }

    return result.decision;
  }

  /**
   * Create new analysis run for existing decision
   * From: POST /api/decisions/[id]/rerun
   */
  async rerun(id: string, userId: string) {
    // 1. Fetch decision and verify ownership
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: {
        runs: {
          where: { status: 'PROCESSING' },
          take: 1,
        },
      },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    // 2. Verify ownership
    if (decision.userId !== userId) {
      throw new ForbiddenException("You don't own this decision");
    }

    // 3. Check if there's already a PROCESSING run
    if (decision.runs.length > 0) {
      throw new ConflictException(
        'Analysis already in progress. Please wait for the current analysis to complete before retrying.',
      );
    }

    // 4. Get AI provider from environment (default to mock)
    const aiProvider = process.env.AI_PROVIDER || 'mock';

    // 5. Create new analysis run and update decision in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create new run
      const run = await tx.decisionAnalysisRun.create({
        data: {
          decisionId: decision.id,
          status: 'PENDING',
          provider: aiProvider,
        },
      });

      // Update decision status and latestRunId
      await tx.decision.update({
        where: { id: decision.id },
        data: {
          status: 'PENDING',
          latestRunId: run.id,
        },
      });

      return { run };
    });

    // 6. Enqueue run for background analysis
    try {
      await this.queueService.enqueueAnalysisRun(result.run.id);
    } catch (queueError) {
      console.error('Failed to enqueue run for analysis:', queueError);
      throw new Error('Failed to enqueue analysis');
    }

    return {
      message: 'Analysis rerun initiated',
      runId: result.run.id,
      status: 'PENDING',
    };
  }
}
