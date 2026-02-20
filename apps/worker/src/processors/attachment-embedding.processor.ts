import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { AttachmentEmbeddingJobData } from "../config/attachment-queue";
import { getEmbeddingProvider } from "../services/embedding.service";
import {
  chunkText,
  DEFAULT_CHUNK_CONFIG,
  getChunkingStats,
  validateAttachmentContent,
} from "../services/chunking.service";
import { publishAttachmentUpdate } from "../services/event-publisher";
import { parseFile, validateParsedText } from "../services/file-parser.service";

const prisma = new PrismaClient();

/**
 * Process Attachment Embedding Job
 * 
 * Chunks an attachment and generates embeddings for each chunk.
 * This is an asynchronous, idempotent process.
 * 
 * Flow:
 * 1. Fetch Attachment from database
 * 2. Validate content
 * 3. Update attachment status to PROCESSING
 * 4. Chunk the content (fixed-size with overlap)
 * 5. Delete existing chunks (idempotency)
 * 6. Create new chunks in database
 * 7. Generate embeddings for each chunk
 * 8. Update attachment status to READY
 * 9. Handle errors with retry support
 * 
 * Cost Control:
 * - Maximum 50 chunks per attachment (configurable)
 * - Truncates content if it exceeds chunk limit
 * - Logs estimated cost before processing
 */
export async function processAttachmentEmbedding(
  job: Job<AttachmentEmbeddingJobData>
): Promise<void> {
  const { attachmentId, filename } = job.data;

  console.log(`[Attachment Job ${job.id}] Processing attachment: ${attachmentId}${filename ? ` (${filename})` : ""}`);

  try {
    // 1. Fetch the attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        userId: true,
        decisionId: true,
        title: true,
        content: true,
        status: true,
      },
    });

    if (!attachment) {
      throw new Error(`Attachment ${attachmentId} not found`);
    }

    console.log(
      `[Attachment Job ${job.id}] Attachment found: "${attachment.title}" (${attachment.content.length} chars base64)`
    );

    // 2. Parse file content if filename is provided
    let textContent: string;

    if (filename) {
      try {
        console.log(`[Attachment Job ${job.id}] Parsing file: ${filename}`);

        // Decode base64 content to buffer
        const fileBuffer = Buffer.from(attachment.content, "base64");

        // Parse file based on extension
        const parseResult = await parseFile(fileBuffer, filename);
        textContent = parseResult.text;

        console.log(
          `[Attachment Job ${job.id}] File parsed successfully: ${textContent.length} chars extracted`
        );

        if (parseResult.metadata) {
          console.log(`[Attachment Job ${job.id}] Metadata:`, parseResult.metadata);
        }

        // Validate parsed text
        validateParsedText(textContent, filename);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "File parsing failed";
        console.error(`[Attachment Job ${job.id}] Parsing failed: ${errorMessage}`);

        // Update attachment status to FAILED
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            status: "FAILED",
            error: errorMessage,
            updatedAt: new Date(),
          },
        });

        // Emit real-time event
        await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);

        throw error; // Re-throw to mark job as failed
      }
    } else {
      // Legacy: content is already text (not base64)
      textContent = attachment.content;

      // Validate content
      try {
        validateAttachmentContent(textContent);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Invalid content";
        console.error(`[Attachment Job ${job.id}] Validation failed: ${errorMessage}`);

        // Update attachment status to FAILED
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            status: "FAILED",
            error: errorMessage,
            updatedAt: new Date(),
          },
        });

        // Emit real-time event
        await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);

        throw error; // Re-throw to mark job as failed
      }
    }

    // 3. Update attachment status to PROCESSING
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: "PROCESSING",
        error: null, // Clear any previous error
        updatedAt: new Date(),
      },
    });

    console.log(`[Attachment Job ${job.id}] Status updated to PROCESSING`);

    // Emit real-time event
    await publishAttachmentUpdate(attachmentId, attachment.decisionId, "PROCESSING");

    // 4. Chunk the content
    const chunkingResult = chunkText(textContent, DEFAULT_CHUNK_CONFIG);

    console.log(
      `[Attachment Job ${job.id}] Chunking complete: ${getChunkingStats(chunkingResult)}`
    );

    if (chunkingResult.wasTruncated) {
      console.warn(
        `[Attachment Job ${job.id}] ⚠️  Content was truncated to ${DEFAULT_CHUNK_CONFIG.maxChunks} chunks`
      );
    }

    // 5. Delete existing chunks (idempotency)
    // This ensures re-running the job produces the same result
    const deletedChunks = await prisma.attachmentChunk.deleteMany({
      where: { attachmentId: attachment.id },
    });

    if (deletedChunks.count > 0) {
      console.log(
        `[Attachment Job ${job.id}] Deleted ${deletedChunks.count} existing chunks (re-run)`
      );
    }

    // 6. Create chunks in database (without embeddings yet)
    console.log(
      `[Attachment Job ${job.id}] Creating ${chunkingResult.chunks.length} chunks...`
    );

    const createdChunks = await Promise.all(
      chunkingResult.chunks.map((chunk) =>
        prisma.attachmentChunk.create({
          data: {
            attachmentId: attachment.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
          },
        })
      )
    );

    console.log(
      `[Attachment Job ${job.id}] ✓ Created ${createdChunks.length} chunks in database`
    );

    // 7. Generate embeddings for each chunk
    console.log(
      `[Attachment Job ${job.id}] Generating embeddings for ${createdChunks.length} chunks...`
    );

    const embeddingProvider = getEmbeddingProvider();
    let successCount = 0;
    let failureCount = 0;

    for (const [index, dbChunk] of createdChunks.entries()) {
      try {
        console.log(
          `[Attachment Job ${job.id}] Embedding chunk ${index + 1}/${createdChunks.length}...`
        );

        // Generate embedding
        const embeddingVector = await embeddingProvider.generateEmbedding(
          dbChunk.content
        );

        // Store embedding using raw SQL (Prisma doesn't support vector type for create)
        await prisma.$executeRaw`
          INSERT INTO "AttachmentChunkEmbedding" ("id", "chunkId", "embedding", "status", "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid(),
            ${dbChunk.id},
            ${JSON.stringify(embeddingVector)}::vector,
            'COMPLETED',
            NOW(),
            NOW()
          )
        `;

        successCount++;
      } catch (error) {
        failureCount++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown embedding error";

        console.error(
          `[Attachment Job ${job.id}] ✗ Failed to embed chunk ${index + 1}: ${errorMessage}`
        );

        // Create failed embedding record using raw SQL
        const placeholderVector = new Array(1536).fill(0);
        await prisma.$executeRaw`
          INSERT INTO "AttachmentChunkEmbedding" ("id", "chunkId", "embedding", "status", "error", "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid(),
            ${dbChunk.id},
            ${JSON.stringify(placeholderVector)}::vector,
            'FAILED',
            ${errorMessage},
            NOW(),
            NOW()
          )
        `;
      }
    }

    console.log(
      `[Attachment Job ${job.id}] Embedding complete: ${successCount} succeeded, ${failureCount} failed`
    );

    // 8. Update attachment status
    if (failureCount === 0) {
      // All embeddings succeeded
      await prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          status: "READY",
          error: null,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[Attachment Job ${job.id}] ✓ Attachment processing completed successfully`
      );

      // Emit real-time event
      await publishAttachmentUpdate(attachmentId, attachment.decisionId, "READY");
    } else if (successCount > 0) {
      // Partial success
      const errorMessage = `${failureCount} of ${createdChunks.length} chunks failed to embed`;
      await prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          status: "READY", // Still mark as READY since some chunks are usable
          error: errorMessage,
          updatedAt: new Date(),
        },
      });

      console.warn(
        `[Attachment Job ${job.id}] ⚠️  Attachment processing completed with ${failureCount} failures`
      );

      // Emit real-time event
      await publishAttachmentUpdate(attachmentId, attachment.decisionId, "READY", errorMessage);
    } else {
      // All embeddings failed
      throw new Error(
        `All ${createdChunks.length} chunks failed to embed`
      );
    }
  } catch (error) {
    console.error(`[Attachment Job ${job.id}] ✗ Error processing attachment:`, error);

    // Extract error message
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during attachment processing";

    // Fetch attachment to get decisionId for event
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { decisionId: true },
    });

    // Update attachment status to FAILED
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: "FAILED",
        error: errorMessage,
        updatedAt: new Date(),
      },
    });

    // Emit real-time event
    if (attachment) {
      await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);
    }

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

