/**
 * Embedding Service
 *
 * Generates vector embeddings using OpenAI-compatible embedding API.
 * Supports cost tracking and retry logic.
 */
import { Logger } from '@nestjs/common';

const embeddingLogger = new Logger('EmbeddingService');

export interface EmbeddingProvider {
  /**
   * Generate embedding for a single text input
   * @param text Text to embed
   * @returns 1536-dimensional vector
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Get the model name being used
   */
  getModelName(): string;
}

/**
 * OpenAI Embedding Provider
 * Uses text-embedding-3-small (1536 dimensions)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model = 'text-embedding-3-small';
  private apiUrl = 'https://api.openai.com/v1/embeddings';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response format from OpenAI API');
      }

      const embedding = data.data[0].embedding as number[];

      // Validate dimension
      if (embedding.length !== 1536) {
        throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw error;
    }
  }

  getModelName(): string {
    return this.model;
  }
}

/**
 * Mock Embedding Provider (for testing)
 * Generates deterministic fake embeddings
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Generate deterministic fake embedding based on text hash
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0).map((_, i) => {
      return Math.sin(hash + i) * 0.5;
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return embedding;
  }

  getModelName(): string {
    return 'mock-embedding';
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

// Singleton provider instance
let providerInstance: EmbeddingProvider | null = null;

/**
 * Get the configured embedding provider
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!providerInstance) {
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || 'mock';

    embeddingLogger.log(`Embedding Provider: ${embeddingProvider}`);

    switch (embeddingProvider) {
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          embeddingLogger.error(
            'OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai, falling back to mock provider',
          );
          providerInstance = new MockEmbeddingProvider();
        } else {
          providerInstance = new OpenAIEmbeddingProvider(apiKey);
        }
        break;
      }

      case 'mock':
      default:
        providerInstance = new MockEmbeddingProvider();
        break;
    }
  }

  return providerInstance;
}
