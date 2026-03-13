import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { jobsTotal, jobDurationSeconds } from "../metrics";
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
import { childLogger } from "../logger";
import { extractTraceContext } from "../trace-context.helper";

const log = childLogger('attachment-processor');
const tracer = trace.getTracer('worker');

const prisma = new PrismaClient();

export async function processAttachmentEmbedding(
  job: Job<AttachmentEmbeddingJobData>
): Promise<void> {
  const { attachmentId, filename } = job.data;
  const QUEUE = 'attachment-embedding';
  const jobStartMs = Date.now();

  const parentCtx = extractTraceContext(job.data as unknown as Record<string, unknown>);

  return context.with(parentCtx, () =>
    tracer.startActiveSpan(
      'worker.attachment-embedding',
      { attributes: { 'job.id': job.id ?? '', 'attachment.id': attachmentId } },
      async (span) => {
        log.info({ jobId: job.id, attachmentId, filename }, 'Processing attachment');

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

          log.info({ jobId: job.id, title: attachment.title, contentLength: attachment.content.length }, 'Attachment found');

          // 2. Parse file content if filename is provided
          let textContent: string;

          if (filename) {
            try {
              log.info({ jobId: job.id, filename }, 'Parsing file');

              const fileBuffer = Buffer.from(attachment.content, "base64");
              const parseResult = await parseFile(fileBuffer, filename);
              textContent = parseResult.text;

              log.info({ jobId: job.id, charsExtracted: textContent.length }, 'File parsed successfully');

              if (parseResult.metadata) {
                log.info({ jobId: job.id, metadata: parseResult.metadata }, 'File metadata');
              }

              validateParsedText(textContent, filename);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "File parsing failed";
              log.error({ jobId: job.id, err: errorMessage }, 'Parsing failed');

              await prisma.attachment.update({
                where: { id: attachmentId },
                data: {
                  status: "FAILED",
                  error: errorMessage,
                  updatedAt: new Date(),
                },
              });

              await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);

              throw error;
            }
          } else {
            textContent = attachment.content;

            try {
              validateAttachmentContent(textContent);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Invalid content";
              log.error({ jobId: job.id, err: errorMessage }, 'Validation failed');

              await prisma.attachment.update({
                where: { id: attachmentId },
                data: {
                  status: "FAILED",
                  error: errorMessage,
                  updatedAt: new Date(),
                },
              });

              await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);

              throw error;
            }
          }

          // 3. Update attachment status to PROCESSING
          await prisma.attachment.update({
            where: { id: attachmentId },
            data: {
              status: "PROCESSING",
              error: null,
              updatedAt: new Date(),
            },
          });

          log.info({ jobId: job.id }, 'Status updated to PROCESSING');

          await publishAttachmentUpdate(attachmentId, attachment.decisionId, "PROCESSING");

          // 4. Chunk the content
          const chunkingResult = chunkText(textContent, DEFAULT_CHUNK_CONFIG);

          log.info({ jobId: job.id, stats: getChunkingStats(chunkingResult) }, 'Chunking complete');

          if (chunkingResult.wasTruncated) {
            log.warn({ jobId: job.id, maxChunks: DEFAULT_CHUNK_CONFIG.maxChunks }, 'Content was truncated');
          }

          // 5. Delete existing chunks (idempotency)
          const deletedChunks = await prisma.attachmentChunk.deleteMany({
            where: { attachmentId: attachment.id },
          });

          if (deletedChunks.count > 0) {
            log.info({ jobId: job.id, deletedCount: deletedChunks.count }, 'Deleted existing chunks (re-run)');
          }

          // 6. Create chunks in database
          log.info({ jobId: job.id, chunkCount: chunkingResult.chunks.length }, 'Creating chunks');

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

          log.info({ jobId: job.id, createdCount: createdChunks.length }, 'Created chunks in database');

          // 7. Generate embeddings for each chunk
          log.info({ jobId: job.id, chunkCount: createdChunks.length }, 'Generating embeddings for chunks');

          const embeddingProvider = getEmbeddingProvider();
          let successCount = 0;
          let failureCount = 0;

          await tracer.startActiveSpan(
            'worker.embedding.generate-chunks',
            {
              attributes: {
                'embedding.provider': embeddingProvider.getModelName(),
                'embedding.chunk_count': createdChunks.length,
                'attachment.id': attachmentId,
              },
            },
            async (batchSpan) => {
              try {
                for (const [index, dbChunk] of createdChunks.entries()) {
                  try {
                    log.info({ jobId: job.id, chunkIndex: index + 1, totalChunks: createdChunks.length }, 'Embedding chunk');

                    const embeddingVector = await embeddingProvider.generateEmbedding(dbChunk.content);

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

                    log.error({ jobId: job.id, chunkIndex: index + 1, err: errorMessage }, 'Failed to embed chunk');

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
              } finally {
                batchSpan.setAttribute('embedding.success_count', successCount);
                batchSpan.setAttribute('embedding.failure_count', failureCount);
                if (failureCount > 0) {
                  batchSpan.setStatus({ code: SpanStatusCode.ERROR, message: `${failureCount} chunk(s) failed` });
                }
                batchSpan.end();
              }
            },
          );

          log.info({ jobId: job.id, successCount, failureCount }, 'Embedding complete');

          // 8. Update attachment status
          if (failureCount === 0) {
            await prisma.attachment.update({
              where: { id: attachmentId },
              data: { status: "READY", error: null, updatedAt: new Date() },
            });

            log.info({ jobId: job.id }, 'Attachment processing completed successfully');

            jobsTotal.inc({ queue: QUEUE, status: 'success' });
            jobDurationSeconds.observe({ queue: QUEUE }, (Date.now() - jobStartMs) / 1000);

            await publishAttachmentUpdate(attachmentId, attachment.decisionId, "READY");
          } else if (successCount > 0) {
            const errorMessage = `${failureCount} of ${createdChunks.length} chunks failed to embed`;
            await prisma.attachment.update({
              where: { id: attachmentId },
              data: { status: "READY", error: errorMessage, updatedAt: new Date() },
            });

            log.warn({ jobId: job.id, failureCount }, 'Attachment processing completed with failures');

            jobsTotal.inc({ queue: QUEUE, status: 'partial' });
            jobDurationSeconds.observe({ queue: QUEUE }, (Date.now() - jobStartMs) / 1000);

            await publishAttachmentUpdate(attachmentId, attachment.decisionId, "READY", errorMessage);
          } else {
            throw new Error(`All ${createdChunks.length} chunks failed to embed`);
          }
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          jobsTotal.inc({ queue: QUEUE, status: 'failed' });
          jobDurationSeconds.observe({ queue: QUEUE }, (Date.now() - jobStartMs) / 1000);

          log.error({ jobId: job.id, err: error }, 'Error processing attachment');

          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown error occurred during attachment processing";

          const attachment = await prisma.attachment.findUnique({
            where: { id: attachmentId },
            select: { decisionId: true },
          });

          await prisma.attachment.update({
            where: { id: attachmentId },
            data: { status: "FAILED", error: errorMessage, updatedAt: new Date() },
          });

          if (attachment) {
            await publishAttachmentUpdate(attachmentId, attachment.decisionId, "FAILED", errorMessage);
          }

          throw error;
        } finally {
          span.end();
        }
      }
    )
  );
}
