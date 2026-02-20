/**
 * Advisory System Types
 *
 * Type definitions for the RAG-based advisory feature.
 */

import {
  RetrievedDecision,
  RetrievedAttachmentChunk,
} from './vector-retrieval.types';

/**
 * Advisory request input
 */
export interface AdvisoryRequest {
  question: string;
  relatedAttachmentId?: string; // Optional: retrieve from specific attachment instead of decisions
}

/**
 * Advisory response output
 */
export interface AdvisoryResponse {
  advice: string; // The LLM-generated advice
  retrievedDecisions: RetrievedDecision[]; // Decisions used as context (empty if using attachment)
  retrievedChunks?: RetrievedAttachmentChunk[]; // Attachment chunks used as context (only if relatedAttachmentId provided)
  metadata: AdvisoryMetadata;
}

/**
 * Metadata about the advisory request
 */
export interface AdvisoryMetadata {
  retrievalCount: number; // Number of decisions/chunks retrieved
  retrievalThreshold: number; // Similarity threshold used
  hasContext: boolean; // Whether any relevant context was found
  retrievalType: 'decisions' | 'attachment'; // What type of retrieval was performed
  attachmentTitle?: string; // Title of attachment (if using attachment retrieval)
  embeddingProvider: string; // Which embedding provider was used
  llmProvider: string; // Which LLM provider was used
  processingTimeMs: number; // Total processing time
}

/**
 * Advisory configuration
 */
export interface AdvisoryConfig {
  // Retrieval settings
  topK: number; // Number of decisions to retrieve
  similarityThreshold: number; // Minimum similarity score (0-1)

  // LLM settings
  model: string; // LLM model to use
  maxTokens: number; // Maximum response length
  temperature: number; // LLM temperature (0-1)
}

/**
 * Default advisory configuration
 */
export const DEFAULT_ADVISORY_CONFIG: AdvisoryConfig = {
  // Retrieval settings
  topK: 3, // Retrieve top 3 most similar decisions
  similarityThreshold: 0.7, // Only use decisions with >70% similarity

  // LLM settings
  model: 'llama-3.3-70b-versatile', // Groq's best model for reasoning
  maxTokens: 1000, // Reasonable length for advice
  temperature: 0.7, // Balanced creativity and consistency
};

/**
 * Advisory error types
 */
export class AdvisoryError extends Error {
  constructor(
    message: string,
    public code: AdvisoryErrorCode,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AdvisoryError';
  }
}

export enum AdvisoryErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  RETRIEVAL_FAILED = 'RETRIEVAL_FAILED',
  LLM_FAILED = 'LLM_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMIT = 'RATE_LIMIT',
}
