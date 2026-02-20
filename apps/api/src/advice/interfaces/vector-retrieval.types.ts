/**
 * Vector Retrieval Types
 */

export interface RetrievedDecision {
  decisionId: string;
  situation: string;
  chosenDecision: string;
  personalReasoning: string | null;
  similarity: number; // Cosine similarity score (0-1, higher is better)
  createdAt: Date;
}

export interface RetrievedAttachmentChunk {
  chunkId: string;
  attachmentId: string;
  attachmentTitle: string;
  chunkIndex: number;
  content: string;
  similarity: number; // Cosine similarity score (0-1, higher is better)
  startOffset: number;
  endOffset: number;
}

export interface RetrievalConfig {
  topK: number; // Number of results to return
  similarityThreshold: number; // Minimum similarity score (0-1)
}

// Default configuration
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  topK: 3, // Retrieve top 3 most similar decisions
  similarityThreshold: 0.7, // Only return decisions with >70% similarity
};

// Default configuration for attachment chunk retrieval
export const DEFAULT_ATTACHMENT_RETRIEVAL_CONFIG: RetrievalConfig = {
  topK: 5, // Retrieve top 5 most similar chunks (more than decisions since chunks are smaller)
  similarityThreshold: 0.65, // Slightly lower threshold since chunks are more granular
};
