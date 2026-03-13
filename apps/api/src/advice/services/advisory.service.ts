import { Injectable, Logger } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdvisoryRequest,
  AdvisoryResponse,
  AdvisoryConfig,
  DEFAULT_ADVISORY_CONFIG,
  AdvisoryError,
  AdvisoryErrorCode,
} from '../interfaces/advice.types';
import { VectorRetrievalService } from './vector-retrieval.service';
import {
  RetrievedDecision,
  RetrievedAttachmentChunk,
  DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG,
} from '../interfaces/vector-retrieval.types';
import {
  buildAdvisoryPrompt,
  buildDocumentAdvisoryPrompt,
} from './advisory-prompt.service';
import { getEmbeddingProvider } from './embedding.service';
import {
  advisoryRequestsTotal,
  advisoryStageDuration,
} from '../../observability/metrics';

/**
 * Advisory Service
 *
 * Orchestrates the RAG-based advisory flow:
 * 1. Generate embedding for user's question
 * 2. Retrieve similar past decisions or attachment chunks
 * 3. Generate advice using LLM with retrieved context
 */

/**
 * Simple LLM client for advisory requests
 * Uses Groq API for generating advice
 */
class AdvisoryLLMClient {
  private apiKey: string;
  private apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateAdvice(
    systemPrompt: string,
    userPrompt: string,
    config: AdvisoryConfig,
  ): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        // Check for rate limiting
        if (response.status === 429) {
          throw new AdvisoryError(
            'Rate limit exceeded. Please try again later.',
            AdvisoryErrorCode.RATE_LIMIT,
            { status: response.status, body: errorBody },
          );
        }

        throw new Error(`Groq API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Groq API');
      }

      const advice = data.choices[0].message.content;

      if (!advice || advice.trim().length === 0) {
        throw new Error('Empty advice from LLM');
      }

      return advice.trim();
    } catch (error) {
      if (error instanceof AdvisoryError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new AdvisoryError(
          `LLM call failed: ${error.message}`,
          AdvisoryErrorCode.LLM_FAILED,
          error,
        );
      }

      throw error;
    }
  }
}

/**
 * Mock LLM client for development
 */
class MockAdvisoryLLMClient {
  async generateAdvice(
    systemPrompt: string,
    userPrompt: string,
    _config: AdvisoryConfig,
  ): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000),
    );

    // Check if this is document-based or decision-based
    const isDocumentBased = userPrompt.includes(
      'relevant excerpt(s) from the document',
    );

    if (isDocumentBased) {
      return `Based on the document provided, here's my analysis:

The key points to consider are:
1. Review the specific sections mentioned in your question
2. Consider the context and implications
3. Think about how this applies to your situation

I recommend taking time to carefully review the relevant sections and considering how they apply to your specific circumstances.`;
    }

    // Decision-based mock response
    return `Based on your past decision patterns, here's my advice:

I notice you tend to value [key pattern from your decisions]. Given your question about "${userPrompt.substring(0, 100)}...", I'd suggest:

1. Consider your past experiences with similar situations
2. Reflect on what worked well before
3. Think about your long-term goals

Remember, the best decision is one that aligns with your values and circumstances.`;
  }
}

const advisoryLogger = new Logger('AdvisoryService');

/**
 * Get the appropriate LLM client based on environment configuration
 */
function getAdvisoryLLMClient(): AdvisoryLLMClient | MockAdvisoryLLMClient {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      advisoryLogger.warn('GROQ_API_KEY not set, falling back to mock client');
      return new MockAdvisoryLLMClient();
    }
    return new AdvisoryLLMClient(apiKey);
  }

  // Default to mock
  return new MockAdvisoryLLMClient();
}

@Injectable()
export class AdvisoryService {
  private readonly logger = new Logger(AdvisoryService.name);
  private readonly tracer = trace.getTracer('api');

  constructor(
    private prisma: PrismaService,
    private vectorRetrieval: VectorRetrievalService,
  ) {}

  /**
   * Generate advice for a user's question
   *
   * This is the main entry point for the advisory feature.
   *
   * Behavior:
   * - If relatedAttachmentId is provided: retrieve from attachment chunks only
   * - If not provided: fallback to decision-based advice
   */
  async generateAdvice(
    userId: string,
    request: AdvisoryRequest,
    config: AdvisoryConfig = DEFAULT_ADVISORY_CONFIG,
  ): Promise<AdvisoryResponse> {
    const startTime = Date.now();
    const advisoryType = request.relatedAttachmentId
      ? 'attachment'
      : 'decision';

    try {
      // 1. Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new AdvisoryError(
          'Question cannot be empty',
          AdvisoryErrorCode.INVALID_INPUT,
        );
      }

      if (request.question.length > 2000) {
        throw new AdvisoryError(
          'Question is too long (max 2000 characters)',
          AdvisoryErrorCode.INVALID_INPUT,
        );
      }

      // 2. Determine retrieval mode: attachment-based or decision-based
      let response: AdvisoryResponse;
      if (request.relatedAttachmentId) {
        response = await this.generateAttachmentBasedAdvice(
          userId,
          request,
          config,
          startTime,
        );
      } else {
        response = await this.generateDecisionBasedAdvice(
          userId,
          request,
          config,
          startTime,
        );
      }

      advisoryRequestsTotal.add(1, { type: advisoryType, status: 'success' });
      return response;
    } catch (error) {
      advisoryRequestsTotal.add(1, { type: advisoryType, status: 'failure' });

      // Re-throw AdvisoryError as-is
      if (error instanceof AdvisoryError) {
        throw error;
      }

      // Wrap other errors
      if (error instanceof Error) {
        throw new AdvisoryError(
          `Advisory generation failed: ${error.message}`,
          AdvisoryErrorCode.LLM_FAILED,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * Generate decision-based advice
   * Retrieves similar past decisions and generates advice based on patterns
   */
  private async generateDecisionBasedAdvice(
    userId: string,
    request: AdvisoryRequest,
    config: AdvisoryConfig,
    startTime: number,
  ): Promise<AdvisoryResponse> {
    const type = 'decision';

    // 1. Check if user has any embeddings
    const hasEmbeddings =
      await this.vectorRetrieval.hasCompletedEmbeddings(userId);

    let retrievedDecisions: RetrievedDecision[] = [];

    if (hasEmbeddings) {
      try {
        // 2. Generate embedding for the question
        const questionEmbedding = await this.tracer.startActiveSpan(
          'advisory.embed-question',
          {
            attributes: {
              'advisory.type': type,
              'question.length': request.question.length,
            },
          },
          async (span) => {
            const t0 = Date.now();
            try {
              const embeddingProvider = getEmbeddingProvider();
              const result = await embeddingProvider.generateEmbedding(
                request.question,
              );
              advisoryStageDuration.record((Date.now() - t0) / 1000, {
                type,
                stage: 'embed_question',
              });
              return result;
            } catch (error) {
              span.recordException(error as Error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: (error as Error).message,
              });
              throw error;
            } finally {
              span.end();
            }
          },
        );

        // 3. Retrieve similar decisions
        await this.tracer.startActiveSpan(
          'advisory.vector-search',
          {
            attributes: {
              'advisory.type': type,
              'db.similarity_threshold': config.similarityThreshold,
              'db.top_k': config.topK,
            },
          },
          async (span) => {
            const t0 = Date.now();
            try {
              retrievedDecisions =
                await this.vectorRetrieval.retrieveSimilarDecisions(
                  userId,
                  questionEmbedding,
                  {
                    topK: config.topK,
                    similarityThreshold: config.similarityThreshold,
                  },
                );
              span.setAttribute('db.results_count', retrievedDecisions.length);
              advisoryStageDuration.record((Date.now() - t0) / 1000, {
                type,
                stage: 'vector_search',
              });
              this.logger.log(
                `Retrieved ${retrievedDecisions.length} decisions for user ${userId}`,
              );
            } catch (error) {
              span.recordException(error as Error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: (error as Error).message,
              });
              throw error;
            } finally {
              span.end();
            }
          },
        );
      } catch (error) {
        // Log error but don't fail the request
        this.logger.error('Retrieval failed', error);

        if (error instanceof Error) {
          throw new AdvisoryError(
            `Retrieval failed: ${error.message}`,
            AdvisoryErrorCode.RETRIEVAL_FAILED,
            error,
          );
        }
      }
    } else {
      this.logger.log(`User ${userId} has no completed embeddings`);
    }

    // 4. Build prompt with retrieved context
    const { systemPrompt, userPrompt } = buildAdvisoryPrompt({
      question: request.question,
      retrievedDecisions,
    });

    // 5. Generate advice using LLM
    const llmProviderName =
      process.env.AI_PROVIDER?.toLowerCase() === 'groq' ? 'groq' : 'mock';

    const advice = await this.tracer.startActiveSpan(
      'advisory.llm-generate',
      {
        attributes: {
          'advisory.type': type,
          'llm.provider': llmProviderName,
          'llm.model': config.model,
          'llm.has_context': retrievedDecisions.length > 0,
          'llm.context_count': retrievedDecisions.length,
        },
      },
      async (span) => {
        const t0 = Date.now();
        try {
          const llmClient = getAdvisoryLLMClient();
          const result = await llmClient.generateAdvice(
            systemPrompt,
            userPrompt,
            config,
          );
          advisoryStageDuration.record((Date.now() - t0) / 1000, {
            type,
            stage: 'llm_generate',
          });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );

    // 6. Build response
    const processingTimeMs = Date.now() - startTime;
    const embeddingProvider = getEmbeddingProvider();

    return {
      advice,
      retrievedDecisions,
      metadata: {
        retrievalCount: retrievedDecisions.length,
        retrievalThreshold: config.similarityThreshold,
        hasContext: retrievedDecisions.length > 0,
        retrievalType: 'decisions',
        embeddingProvider: embeddingProvider.getModelName(),
        llmProvider: llmProviderName,
        processingTimeMs,
      },
    };
  }

  /**
   * Generate attachment-based advice
   * Retrieves relevant chunks from a specific attachment and generates grounded advice
   */
  private async generateAttachmentBasedAdvice(
    userId: string,
    request: AdvisoryRequest,
    config: AdvisoryConfig,
    startTime: number,
  ): Promise<AdvisoryResponse> {
    const type = 'attachment';
    const attachmentId = request.relatedAttachmentId!;

    // 1. Verify attachment exists and belongs to user
    let attachment;
    try {
      attachment = await this.vectorRetrieval.verifyAttachmentOwnership(
        userId,
        attachmentId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new AdvisoryError(
          error.message,
          AdvisoryErrorCode.INVALID_INPUT,
          error,
        );
      }
      throw error;
    }

    // 2. Check if attachment has completed embeddings
    const hasEmbeddings =
      await this.vectorRetrieval.hasCompletedAttachmentEmbeddings(attachmentId);

    if (!hasEmbeddings) {
      throw new AdvisoryError(
        `Attachment "${attachment.title}" is not ready for retrieval. Status: ${attachment.status}`,
        AdvisoryErrorCode.RETRIEVAL_FAILED,
      );
    }

    let retrievedChunks: RetrievedAttachmentChunk[] = [];

    try {
      // 3. Generate embedding for the question
      const questionEmbedding = await this.tracer.startActiveSpan(
        'advisory.embed-question',
        {
          attributes: {
            'advisory.type': type,
            'question.length': request.question.length,
            'attachment.id': attachmentId,
          },
        },
        async (span) => {
          const t0 = Date.now();
          try {
            const embeddingProvider = getEmbeddingProvider();
            const result = await embeddingProvider.generateEmbedding(
              request.question,
            );
            advisoryStageDuration.record((Date.now() - t0) / 1000, {
              type,
              stage: 'embed_question',
            });
            return result;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );

      // 4. Retrieve similar chunks from the attachment
      await this.tracer.startActiveSpan(
        'advisory.vector-search',
        {
          attributes: {
            'advisory.type': type,
            'attachment.id': attachmentId,
            'db.similarity_threshold':
              DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG.similarityThreshold,
            'db.top_k': DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG.topK,
          },
        },
        async (span) => {
          const t0 = Date.now();
          try {
            retrievedChunks =
              await this.vectorRetrieval.retrieveSimilarAttachmentChunks(
                userId,
                attachmentId,
                questionEmbedding,
                DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG,
              );
            span.setAttribute('db.results_count', retrievedChunks.length);
            advisoryStageDuration.record((Date.now() - t0) / 1000, {
              type,
              stage: 'vector_search',
            });
            this.logger.log(
              `Retrieved ${retrievedChunks.length} chunks from attachment "${attachment.title}" for user ${userId}`,
            );
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    } catch (error) {
      this.logger.error('Attachment chunk retrieval failed', error);

      if (error instanceof Error) {
        throw new AdvisoryError(
          `Attachment retrieval failed: ${error.message}`,
          AdvisoryErrorCode.RETRIEVAL_FAILED,
          error,
        );
      }
    }

    // 5. Build document-grounded prompt
    const { systemPrompt, userPrompt } = buildDocumentAdvisoryPrompt({
      question: request.question,
      retrievedChunks,
      attachmentTitle: attachment.title,
    });

    // 6. Generate advice using LLM
    const llmProviderName =
      process.env.AI_PROVIDER?.toLowerCase() === 'groq' ? 'groq' : 'mock';

    const advice = await this.tracer.startActiveSpan(
      'advisory.llm-generate',
      {
        attributes: {
          'advisory.type': type,
          'llm.provider': llmProviderName,
          'llm.model': config.model,
          'llm.has_context': retrievedChunks.length > 0,
          'llm.context_count': retrievedChunks.length,
          'attachment.id': attachmentId,
        },
      },
      async (span) => {
        const t0 = Date.now();
        try {
          const llmClient = getAdvisoryLLMClient();
          const result = await llmClient.generateAdvice(
            systemPrompt,
            userPrompt,
            config,
          );
          advisoryStageDuration.record((Date.now() - t0) / 1000, {
            type,
            stage: 'llm_generate',
          });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );

    // 7. Build response
    const processingTimeMs = Date.now() - startTime;
    const embeddingProvider = getEmbeddingProvider();

    return {
      advice,
      retrievedDecisions: [], // Empty for attachment-based retrieval
      retrievedChunks,
      metadata: {
        retrievalCount: retrievedChunks.length,
        retrievalThreshold:
          DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG.similarityThreshold,
        hasContext: retrievedChunks.length > 0,
        retrievalType: 'attachment',
        attachmentTitle: attachment.title,
        embeddingProvider: embeddingProvider.getModelName(),
        llmProvider: llmProviderName,
        processingTimeMs,
      },
    };
  }

  /**
   * Get advisory system status for a user
   * Returns embedding statistics
   */
  async getAdvisoryStatus(userId: string) {
    const stats = await this.prisma.decisionEmbedding.groupBy({
      by: ['status'],
      where: {
        decision: {
          userId: userId,
        },
      },
      _count: {
        status: true,
      },
    });

    const result = {
      total: 0,
      completed: 0,
      pending: 0,
      failed: 0,
    };

    stats.forEach((stat) => {
      const count = stat._count.status;
      result.total += count;

      switch (stat.status) {
        case 'COMPLETED':
          result.completed = count;
          break;
        case 'PENDING':
          result.pending = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
      }
    });

    return {
      available: result.completed > 0,
      embeddings: result,
      config: {
        topK: DEFAULT_ADVISORY_CONFIG.topK,
        similarityThreshold: DEFAULT_ADVISORY_CONFIG.similarityThreshold,
        model: DEFAULT_ADVISORY_CONFIG.model,
      },
    };
  }
}
