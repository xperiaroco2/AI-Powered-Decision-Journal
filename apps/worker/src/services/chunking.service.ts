/**
 * Chunking Service
 * 
 * Provides fixed-size text chunking with overlap for RAG ingestion.
 * 
 * Design Principles:
 * - Fixed-size chunking (simple, deterministic, predictable)
 * - Character-based with token estimation (4 chars ≈ 1 token)
 * - Overlap to preserve context across chunk boundaries
 * - Cost control via maximum chunk limits
 * - Deterministic ordering (chunkIndex)
 */

export interface ChunkConfig {
  /**
   * Target chunk size in tokens.
   * Default: 500 tokens (~2000 characters)
   */
  chunkSizeTokens: number;

  /**
   * Overlap between chunks in tokens.
   * Default: 100 tokens (~400 characters)
   */
  overlapTokens: number;

  /**
   * Maximum number of chunks per attachment.
   * Cost control: prevents runaway embedding costs.
   * Default: 50 chunks (25,000 tokens = ~$0.0005 in embeddings)
   */
  maxChunks: number;
}

export interface TextChunk {
  /**
   * Sequential index (0, 1, 2, ...)
   */
  chunkIndex: number;

  /**
   * Chunk text content
   */
  content: string;

  /**
   * Character offset in original text (inclusive)
   */
  startOffset: number;

  /**
   * Character offset in original text (exclusive)
   */
  endOffset: number;

  /**
   * Estimated token count
   */
  estimatedTokens: number;
}

export interface ChunkingResult {
  /**
   * Array of text chunks
   */
  chunks: TextChunk[];

  /**
   * Total character count of original text
   */
  totalCharacters: number;

  /**
   * Total estimated tokens in original text
   */
  totalEstimatedTokens: number;

  /**
   * Whether chunking was truncated due to maxChunks limit
   */
  wasTruncated: boolean;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSizeTokens: 500,    // ~2000 characters
  overlapTokens: 100,      // ~400 characters
  maxChunks: 50,           // Max 25,000 tokens per attachment
};

/**
 * Estimate token count from character count.
 * 
 * Rule of thumb: 1 token ≈ 4 characters for English text.
 * This is a rough approximation - actual tokenization varies by model.
 * 
 * @param text Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert token count to approximate character count.
 * 
 * @param tokens Token count
 * @returns Approximate character count
 */
export function tokensToCharacters(tokens: number): number {
  return tokens * 4;
}

/**
 * Chunk text into fixed-size segments with overlap.
 * 
 * Algorithm:
 * 1. Calculate chunk size and overlap in characters
 * 2. Split text at chunk boundaries
 * 3. Apply overlap by backing up before each chunk
 * 4. Enforce maxChunks limit (truncate if exceeded)
 * 5. Return chunks with metadata
 * 
 * @param text Text to chunk
 * @param config Chunking configuration
 * @returns Chunking result with chunks and metadata
 */
export function chunkText(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): ChunkingResult {
  // Handle empty text
  if (!text || text.trim().length === 0) {
    return {
      chunks: [],
      totalCharacters: 0,
      totalEstimatedTokens: 0,
      wasTruncated: false,
    };
  }

  // Normalize whitespace (collapse multiple spaces, normalize line breaks)
  const normalizedText = text
    .replace(/\r\n/g, "\n")  // Normalize line breaks
    .replace(/\r/g, "\n")    // Normalize line breaks
    .replace(/\t/g, " ")     // Replace tabs with spaces
    .trim();

  const totalCharacters = normalizedText.length;
  const totalEstimatedTokens = estimateTokenCount(normalizedText);

  // Convert token sizes to character sizes
  const chunkSizeChars = tokensToCharacters(config.chunkSizeTokens);
  const overlapChars = tokensToCharacters(config.overlapTokens);

  // If text is smaller than one chunk, return it as a single chunk
  if (totalCharacters <= chunkSizeChars) {
    return {
      chunks: [
        {
          chunkIndex: 0,
          content: normalizedText,
          startOffset: 0,
          endOffset: totalCharacters,
          estimatedTokens: totalEstimatedTokens,
        },
      ],
      totalCharacters,
      totalEstimatedTokens,
      wasTruncated: false,
    };
  }

  // Calculate step size (chunk size - overlap)
  const stepSize = chunkSizeChars - overlapChars;

  if (stepSize <= 0) {
    throw new Error(
      `Invalid chunk configuration: overlap (${config.overlapTokens} tokens) must be less than chunk size (${config.chunkSizeTokens} tokens)`
    );
  }

  const chunks: TextChunk[] = [];
  let currentOffset = 0;
  let chunkIndex = 0;

  while (currentOffset < totalCharacters) {
    // Check if we've hit the max chunks limit
    if (chunkIndex >= config.maxChunks) {
      return {
        chunks,
        totalCharacters,
        totalEstimatedTokens,
        wasTruncated: true,
      };
    }

    // Calculate chunk boundaries
    const startOffset = currentOffset;
    const endOffset = Math.min(currentOffset + chunkSizeChars, totalCharacters);

    // Extract chunk content
    const content = normalizedText.substring(startOffset, endOffset);

    // Create chunk
    chunks.push({
      chunkIndex,
      content,
      startOffset,
      endOffset,
      estimatedTokens: estimateTokenCount(content),
    });

    // Move to next chunk (with overlap)
    currentOffset += stepSize;
    chunkIndex++;
  }

  return {
    chunks,
    totalCharacters,
    totalEstimatedTokens,
    wasTruncated: false,
  };
}

/**
 * Calculate the cost of embedding a chunking result.
 * 
 * Based on OpenAI text-embedding-3-small pricing:
 * $0.00002 per 1K tokens
 * 
 * @param result Chunking result
 * @returns Estimated cost in USD
 */
export function estimateEmbeddingCost(result: ChunkingResult): number {
  const totalTokens = result.chunks.reduce(
    (sum, chunk) => sum + chunk.estimatedTokens,
    0
  );
  return (totalTokens / 1000) * 0.00002;
}

/**
 * Validate attachment content before chunking.
 * 
 * Checks:
 * - Content is not empty
 * - Content is not too large (prevents abuse)
 * 
 * @param content Attachment content
 * @param maxSizeChars Maximum allowed size in characters (default: 1M chars = ~250K tokens)
 * @throws Error if validation fails
 */
export function validateAttachmentContent(
  content: string,
  maxSizeChars: number = 1_000_000
): void {
  if (!content || content.trim().length === 0) {
    throw new Error("Attachment content cannot be empty");
  }

  if (content.length > maxSizeChars) {
    throw new Error(
      `Attachment content too large: ${content.length} characters (max: ${maxSizeChars})`
    );
  }
}

/**
 * Get chunking statistics for logging/monitoring.
 * 
 * @param result Chunking result
 * @returns Human-readable statistics
 */
export function getChunkingStats(result: ChunkingResult): string {
  const avgChunkSize = result.chunks.length > 0
    ? Math.round(
        result.chunks.reduce((sum, c) => sum + c.content.length, 0) /
          result.chunks.length
      )
    : 0;

  return [
    `Chunks: ${result.chunks.length}`,
    `Total chars: ${result.totalCharacters}`,
    `Est. tokens: ${result.totalEstimatedTokens}`,
    `Avg chunk size: ${avgChunkSize} chars`,
    `Truncated: ${result.wasTruncated ? "YES" : "NO"}`,
    `Est. cost: $${estimateEmbeddingCost(result).toFixed(6)}`,
  ].join(" | ");
}

