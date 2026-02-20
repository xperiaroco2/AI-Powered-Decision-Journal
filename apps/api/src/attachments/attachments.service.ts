import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/**
 * Attachments Service
 *
 * Handles attachment operations and file uploads.
 * Migrated from:
 * - apps/web/app/api/attachments/route.ts
 * - apps/web/app/api/decisions/[id]/attachments/route.ts
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get all attachments for user
   * From: GET /api/attachments
   */
  async findAll(userId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        status: true,
        decisionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { attachments };
  }

  /**
   * Get all attachments for a decision
   * From: GET /api/decisions/[id]/attachments
   */
  async findByDecision(decisionId: string, userId: string) {
    // Verify decision exists and belongs to user
    const decision = await this.prisma.decision.findUnique({
      where: { id: decisionId },
      select: { id: true, userId: true },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    if (decision.userId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    // Fetch attachments with chunk counts
    const attachments = await this.prisma.attachment.findMany({
      where: { decisionId },
      select: {
        id: true,
        title: true,
        status: true,
        error: true,
        createdAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform response
    return {
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        title: attachment.title,
        status: attachment.status,
        error: attachment.error,
        chunkCount: attachment._count.chunks,
        createdAt: attachment.createdAt,
      })),
    };
  }

  /**
   * Create attachment with file upload
   * From: POST /api/decisions/[id]/attachments
   */
  async create(
    decisionId: string,
    userId: string,
    title: string,
    file: Express.Multer.File,
  ) {
    // Verify decision exists and belongs to user
    const decision = await this.prisma.decision.findUnique({
      where: { id: decisionId },
      select: { id: true, userId: true },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    if (decision.userId !== userId) {
      throw new ForbiddenException(
        'You can only add attachments to your own decisions.',
      );
    }

    // Validate file
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    // Check file extension
    const allowedExtensions = /\.(txt|md|pdf|docx?)$/i;
    if (!file.originalname.match(allowedExtensions)) {
      throw new BadRequestException(
        'Only .txt, .md, .pdf, .doc, and .docx files are supported',
      );
    }

    console.log(
      `[Attachment Service] User ${userId} uploading file for decision ${decisionId}: "${title}" (${file.originalname}, ${file.size} bytes)`,
    );

    // Convert file to base64
    const fileBuffer = file.buffer;
    const fileBase64 = fileBuffer.toString('base64');

    // Create attachment in database with file data
    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        decisionId,
        title,
        content: fileBase64, // Store file as base64 temporarily
        status: 'PENDING',
      },
      select: {
        id: true,
        decisionId: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(
      `[Attachment Service] ✓ Created attachment ${attachment.id} with file ${file.originalname}`,
    );

    // Enqueue attachment for chunking and embedding
    try {
      await this.queueService.enqueueAttachmentEmbedding(
        attachment.id,
        file.originalname,
      );
      console.log(
        `[Attachment Service] ✓ Enqueued attachment ${attachment.id} for processing`,
      );
    } catch (queueError) {
      console.error(
        `[Attachment Service] ✗ Failed to enqueue attachment ${attachment.id}:`,
        queueError,
      );

      // Update attachment status to FAILED
      await this.prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          status: 'FAILED',
          error: 'Failed to enqueue for processing',
        },
      });

      throw new Error('Failed to enqueue attachment for processing');
    }

    return attachment;
  }
}
