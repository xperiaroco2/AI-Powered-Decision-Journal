import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RetrievedDecision,
  RetrievedAttachmentChunk,
  RetrievalConfig,
  DEFAULT_RETRIEVAL_CONFIG,
  DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG,
} from '../interfaces/vector-retrieval.types';

/**
 * Vector Retrieval Service
 *
 * Performs semantic search over Decision embeddings and Attachment chunks using pgvector.
 * Uses cosine similarity for ranking.
 */
@Injectable()
export class VectorRetrievalService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieve similar decisions using vector similarity search
   *
   * @param userId User ID to filter by (ensures user-scoped retrieval)
   * @param queryEmbedding Query embedding vector (1536 dimensions)
   * @param config Retrieval configuration (topK, threshold)
   * @returns Array of retrieved decisions with similarity scores
   */
  async retrieveSimilarDecisions(
    userId: string,
    queryEmbedding: number[],
    config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG,
  ): Promise<RetrievedDecision[]> {
    // Validate embedding dimension
    if (queryEmbedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${queryEmbedding.length}`,
      );
    }

    // Convert embedding array to PostgreSQL vector format
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    try {
      // Perform vector similarity search using raw SQL
      // We use raw SQL because Prisma doesn't natively support pgvector operations
      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          decisionId: string;
          situation: string;
          chosenDecision: string;
          personalReasoning: string | null;
          similarity: number;
          createdAt: Date;
        }>
      >(
        `
        SELECT 
          d.id AS "decisionId",
          d.situation,
          d."chosenDecision",
          d."personalReasoning",
          d."createdAt",
          1 - (de.embedding <=> $1::vector) AS similarity
        FROM "Decision" d
        INNER JOIN "DecisionEmbedding" de ON de."decisionId" = d.id
        WHERE d."userId" = $2
          AND de.status = 'COMPLETED'
          AND (1 - (de.embedding <=> $1::vector)) >= $3
        ORDER BY de.embedding <=> $1::vector ASC
        LIMIT $4
        `,
        embeddingString,
        userId,
        config.similarityThreshold,
        config.topK,
      );

      return results.map((row) => ({
        decisionId: row.decisionId,
        situation: row.situation,
        chosenDecision: row.chosenDecision,
        personalReasoning: row.personalReasoning,
        similarity: Number(row.similarity), // Ensure it's a number
        createdAt: row.createdAt,
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Vector retrieval failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a user has any completed embeddings
   * Useful for determining if retrieval is possible
   */
  async hasCompletedEmbeddings(userId: string): Promise<boolean> {
    const count = await this.prisma.decisionEmbedding.count({
      where: {
        status: 'COMPLETED',
        decision: {
          userId: userId,
        },
      },
    });

    return count > 0;
  }

  /**
   * Retrieve similar attachment chunks using vector similarity search
   *
   * This function performs semantic search over AttachmentChunk embeddings
   * for a specific attachment, returning the most relevant chunks.
   *
   * @param userId User ID to filter by (ensures user-scoped retrieval)
   * @param attachmentId Attachment ID to retrieve chunks from
   * @param queryEmbedding Query embedding vector (1536 dimensions)
   * @param config Retrieval configuration (topK, threshold)
   * @returns Array of retrieved chunks with similarity scores, ordered by chunkIndex
   */
  async retrieveSimilarAttachmentChunks(
    userId: string,
    attachmentId: string,
    queryEmbedding: number[],
    config: RetrievalConfig = DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG,
  ): Promise<RetrievedAttachmentChunk[]> {
    // Validate embedding dimension
    if (queryEmbedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${queryEmbedding.length}`,
      );
    }

    // Convert embedding array to PostgreSQL vector format
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    try {
      // Perform vector similarity search using raw SQL
      // We use raw SQL because Prisma doesn't natively support pgvector operations
      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          chunkId: string;
          attachmentId: string;
          attachmentTitle: string;
          chunkIndex: number;
          content: string;
          similarity: number;
          startOffset: number;
          endOffset: number;
        }>
      >(
        `
        SELECT
          ac.id AS "chunkId",
          ac."attachmentId",
          a.title AS "attachmentTitle",
          ac."chunkIndex",
          ac.content,
          ac."startOffset",
          ac."endOffset",
          1 - (ace.embedding <=> $1::vector) AS similarity
        FROM "AttachmentChunk" ac
        INNER JOIN "AttachmentChunkEmbedding" ace ON ace."chunkId" = ac.id
        INNER JOIN "Attachment" a ON a.id = ac."attachmentId"
        WHERE a."userId" = $2
          AND ac."attachmentId" = $3
          AND ace.status = 'COMPLETED'
          AND (1 - (ace.embedding <=> $1::vector)) >= $4
        ORDER BY ace.embedding <=> $1::vector ASC
        LIMIT $5
        `,
        embeddingString,
        userId,
        attachmentId,
        config.similarityThreshold,
        config.topK,
      );

      // Sort by chunkIndex to preserve document order
      // This is important for maintaining context flow in the prompt
      return results
        .map((row) => ({
          chunkId: row.chunkId,
          attachmentId: row.attachmentId,
          attachmentTitle: row.attachmentTitle,
          chunkIndex: Number(row.chunkIndex),
          content: row.content,
          similarity: Number(row.similarity),
          startOffset: Number(row.startOffset),
          endOffset: Number(row.endOffset),
        }))
        .sort((a, b) => a.chunkIndex - b.chunkIndex); // Sort by chunk order
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Attachment chunk retrieval failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if an attachment has any completed chunk embeddings
   * Useful for determining if retrieval is possible
   */
  async hasCompletedAttachmentEmbeddings(
    attachmentId: string,
  ): Promise<boolean> {
    const count = await this.prisma.attachmentChunkEmbedding.count({
      where: {
        status: 'COMPLETED',
        chunk: {
          attachmentId: attachmentId,
        },
      },
    });

    return count > 0;
  }

  /**
   * Verify that an attachment exists and belongs to the user
   * Returns the attachment if valid, throws error otherwise
   */
  async verifyAttachmentOwnership(
    userId: string,
    attachmentId: string,
  ): Promise<{ id: string; title: string; status: string }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, title: true, status: true, userId: true },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    if (attachment.userId !== userId) {
      throw new Error('Unauthorized: Attachment does not belong to user');
    }

    return {
      id: attachment.id,
      title: attachment.title,
      status: attachment.status,
    };
  }
}
