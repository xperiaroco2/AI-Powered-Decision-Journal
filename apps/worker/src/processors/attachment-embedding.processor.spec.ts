/**
 * Attachment Embedding Processor Unit Tests
 *
 * Tests the core business logic for processing attachment embeddings.
 */

// Module-level mock functions that will be accessible in tests
let mockFindUnique: jest.Mock;
let mockUpdate: jest.Mock;
let mockDeleteMany: jest.Mock;
let mockCreate: jest.Mock;
let mockExecuteRaw: jest.Mock;

// Mock dependencies BEFORE imports
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      attachment: {
        get findUnique() { return mockFindUnique; },
        get update() { return mockUpdate; },
      },
      attachmentChunk: {
        get deleteMany() { return mockDeleteMany; },
        get create() { return mockCreate; },
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
jest.mock('../services/chunking.service');
jest.mock('../services/event-publisher');
jest.mock('../services/file-parser.service');

import { processAttachmentEmbedding } from './attachment-embedding.processor';
import { PrismaClient } from '@prisma/client';
import { getEmbeddingProvider } from '../services/embedding.service';
import { chunkText, validateAttachmentContent } from '../services/chunking.service';
import { publishAttachmentUpdate } from '../services/event-publisher';
import { parseFile, validateParsedText } from '../services/file-parser.service';

describe('Attachment Embedding Processor', () => {
  let mockProvider: any;
  let mockJob: any;

  beforeEach(() => {
    // Reset mock functions
    mockFindUnique = jest.fn();
    mockUpdate = jest.fn();
    mockDeleteMany = jest.fn();
    mockCreate = jest.fn();
    mockExecuteRaw = jest.fn();

    // Create mock embedding provider
    mockProvider = {
      generateEmbedding: jest.fn(),
    };

    (getEmbeddingProvider as jest.Mock).mockReturnValue(mockProvider);
    (publishAttachmentUpdate as jest.Mock).mockResolvedValue(undefined);
    (validateAttachmentContent as jest.Mock).mockImplementation(() => {});
    (validateParsedText as jest.Mock).mockImplementation(() => {});

    // Create mock job
    mockJob = {
      id: 'job-123',
      data: {
        attachmentId: 'attachment-456',
        filename: null,
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful processing - text content', () => {
    it('should process attachment with text content successfully', async () => {
      const mockAttachment = {
        id: 'attachment-456',
        userId: 'user-123',
        decisionId: 'decision-789',
        title: 'Test Attachment',
        content: 'This is test content for the attachment',
        status: 'PENDING',
      };

      const mockChunks = [
        {
          chunkIndex: 0,
          content: 'This is test content',
          startOffset: 0,
          endOffset: 20,
          estimatedTokens: 5,
        },
        {
          chunkIndex: 1,
          content: 'for the attachment',
          startOffset: 21,
          endOffset: 39,
          estimatedTokens: 4,
        },
      ];

      const mockChunkingResult = {
        chunks: mockChunks,
        totalCharacters: 39,
        totalEstimatedTokens: 9,
        wasTruncated: false,
      };

      const mockEmbedding = new Array(1536).fill(0.5);

      mockFindUnique.mockResolvedValue(mockAttachment as any);
      mockUpdate.mockResolvedValue({} as any);
      mockDeleteMany.mockResolvedValue({ count: 0 });
      mockCreate.mockImplementation((args: any) =>
        Promise.resolve({ id: `chunk-${args.data.chunkIndex}`, ...args.data } as any),
      );
      (chunkText as jest.Mock).mockReturnValue(mockChunkingResult);
      mockProvider.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockExecuteRaw.mockResolvedValue(1);

      await processAttachmentEmbedding(mockJob);

      // Verify attachment was fetched
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        select: {
          id: true,
          userId: true,
          decisionId: true,
          title: true,
          content: true,
          status: true,
        },
      });

      // Verify content was validated
      expect(validateAttachmentContent).toHaveBeenCalledWith(mockAttachment.content);

      // Verify status updated to PROCESSING
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        data: {
          status: 'PROCESSING',
          error: null,
          updatedAt: expect.any(Date),
        },
      });

      // Verify PROCESSING event published
      expect(publishAttachmentUpdate).toHaveBeenCalledWith(
        'attachment-456',
        'decision-789',
        'PROCESSING',
      );

      // Verify content was chunked
      expect(chunkText).toHaveBeenCalledWith(
        mockAttachment.content,
        expect.any(Object),
      );

      // Verify old chunks were deleted
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { attachmentId: 'attachment-456' },
      });

      // Verify new chunks were created
      expect(mockCreate).toHaveBeenCalledTimes(2);

      // Verify embeddings were generated
      expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2);

      // Verify embeddings were stored
      expect(mockExecuteRaw).toHaveBeenCalledTimes(2);

      // Verify status updated to READY
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        data: {
          status: 'READY',
          error: null,
          updatedAt: expect.any(Date),
        },
      });

      // Verify READY event published
      expect(publishAttachmentUpdate).toHaveBeenCalledWith(
        'attachment-456',
        'decision-789',
        'READY',
      );
    });
  });

  describe('successful processing - file parsing', () => {
    it('should parse PDF file and process embeddings', async () => {
      const mockAttachment = {
        id: 'attachment-456',
        userId: 'user-123',
        decisionId: 'decision-789',
        title: 'Test PDF',
        content: Buffer.from('fake pdf content').toString('base64'),
        status: 'PENDING',
      };

      const mockParseResult = {
        text: 'Extracted PDF text content',
        metadata: { pages: 5 },
      };

      const mockChunkingResult = {
        chunks: [
          {
            chunkIndex: 0,
            content: 'Extracted PDF text content',
            startOffset: 0,
            endOffset: 26,
            estimatedTokens: 6,
          },
        ],
        totalCharacters: 26,
        totalEstimatedTokens: 6,
        wasTruncated: false,
      };

      const mockEmbedding = new Array(1536).fill(0.5);

      mockJob.data.filename = 'document.pdf';

      mockFindUnique.mockResolvedValue(mockAttachment as any);
      mockUpdate.mockResolvedValue({} as any);
      mockDeleteMany.mockResolvedValue({ count: 0 });
      mockCreate.mockResolvedValue({ id: 'chunk-0' } as any);
      (parseFile as jest.Mock).mockResolvedValue(mockParseResult);
      (chunkText as jest.Mock).mockReturnValue(mockChunkingResult);
      mockProvider.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockExecuteRaw.mockResolvedValue(1);

      await processAttachmentEmbedding(mockJob);

      // Verify file was parsed
      expect(parseFile).toHaveBeenCalledWith(expect.any(Buffer), 'document.pdf');

      // Verify parsed text was validated
      expect(validateParsedText).toHaveBeenCalledWith(
        'Extracted PDF text content',
        'document.pdf',
      );
    });
  });

  describe('error handling', () => {
    it('should throw error if attachment not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(processAttachmentEmbedding(mockJob)).rejects.toThrow(
        'Attachment attachment-456 not found',
      );
    });

    it('should handle file parsing errors', async () => {
      const mockAttachment = {
        id: 'attachment-456',
        userId: 'user-123',
        decisionId: 'decision-789',
        title: 'Test PDF',
        content: Buffer.from('fake pdf').toString('base64'),
        status: 'PENDING',
      };

      mockJob.data.filename = 'document.pdf';

      mockFindUnique.mockResolvedValue(mockAttachment as any);
      mockUpdate.mockResolvedValue({} as any);
      (parseFile as jest.Mock).mockRejectedValue(new Error('Invalid PDF'));

      await expect(processAttachmentEmbedding(mockJob)).rejects.toThrow('Invalid PDF');

      // Verify status updated to FAILED
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        data: {
          status: 'FAILED',
          error: 'Invalid PDF',
          updatedAt: expect.any(Date),
        },
      });

      // Verify FAILED event published
      expect(publishAttachmentUpdate).toHaveBeenCalledWith(
        'attachment-456',
        'decision-789',
        'FAILED',
        'Invalid PDF',
      );
    });

    it('should handle validation errors', async () => {
      const mockAttachment = {
        id: 'attachment-456',
        userId: 'user-123',
        decisionId: 'decision-789',
        title: 'Test',
        content: '',
        status: 'PENDING',
      };

      mockFindUnique.mockResolvedValue(mockAttachment as any);
      mockUpdate.mockResolvedValue({} as any);
      (validateAttachmentContent as jest.Mock).mockImplementation(() => {
        throw new Error('Content cannot be empty');
      });

      await expect(processAttachmentEmbedding(mockJob)).rejects.toThrow(
        'Content cannot be empty',
      );

      // Verify status updated to FAILED
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        data: {
          status: 'FAILED',
          error: 'Content cannot be empty',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle partial embedding failures', async () => {
      const mockAttachment = {
        id: 'attachment-456',
        userId: 'user-123',
        decisionId: 'decision-789',
        title: 'Test',
        content: 'Test content',
        status: 'PENDING',
      };

      const mockChunkingResult = {
        chunks: [
          { chunkIndex: 0, content: 'Chunk 1', startOffset: 0, endOffset: 7, estimatedTokens: 2 },
          { chunkIndex: 1, content: 'Chunk 2', startOffset: 8, endOffset: 15, estimatedTokens: 2 },
        ],
        totalCharacters: 15,
        totalEstimatedTokens: 4,
        wasTruncated: false,
      };

      const mockEmbedding = new Array(1536).fill(0.5);

      mockFindUnique.mockResolvedValue(mockAttachment as any);
      mockUpdate.mockResolvedValue({} as any);
      mockDeleteMany.mockResolvedValue({ count: 0 });
      mockCreate.mockImplementation((args: any) =>
        Promise.resolve({ id: `chunk-${args.data.chunkIndex}`, ...args.data } as any),
      );
      (chunkText as jest.Mock).mockReturnValue(mockChunkingResult);

      // First embedding succeeds, second fails
      mockProvider.generateEmbedding
        .mockResolvedValueOnce(mockEmbedding)
        .mockRejectedValueOnce(new Error('API rate limit'));

      mockExecuteRaw.mockResolvedValue(1);

      await processAttachmentEmbedding(mockJob);

      // Verify status updated to READY with error message
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'attachment-456' },
        data: {
          status: 'READY',
          error: '1 of 2 chunks failed to embed',
          updatedAt: expect.any(Date),
        },
      });

      // Verify READY event published with error
      expect(publishAttachmentUpdate).toHaveBeenCalledWith(
        'attachment-456',
        'decision-789',
        'READY',
        '1 of 2 chunks failed to embed',
      );
    });
  });
});

