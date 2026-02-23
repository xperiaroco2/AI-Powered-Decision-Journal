/**
 * Chunking Service Unit Tests
 *
 * Tests text chunking logic, token estimation, and validation.
 */

import {
  chunkText,
  estimateTokenCount,
  tokensToCharacters,
  validateAttachmentContent,
  estimateEmbeddingCost,
  getChunkingStats,
  DEFAULT_CHUNK_CONFIG,
} from './chunking.service';

describe('Chunking Service', () => {
  describe('estimateTokenCount', () => {
    it('should estimate tokens using 4 chars per token rule', () => {
      expect(estimateTokenCount('test')).toBe(1); // 4 chars = 1 token
      expect(estimateTokenCount('test text')).toBe(3); // 9 chars = 3 tokens (rounded up)
      expect(estimateTokenCount('a'.repeat(100))).toBe(25); // 100 chars = 25 tokens
    });

    it('should handle empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });
  });

  describe('tokensToCharacters', () => {
    it('should convert tokens to characters using 4 chars per token', () => {
      expect(tokensToCharacters(1)).toBe(4);
      expect(tokensToCharacters(100)).toBe(400);
      expect(tokensToCharacters(500)).toBe(2000);
    });
  });

  describe('chunkText', () => {
    it('should return empty result for empty text', () => {
      const result = chunkText('');

      expect(result.chunks).toHaveLength(0);
      expect(result.totalCharacters).toBe(0);
      expect(result.totalEstimatedTokens).toBe(0);
      expect(result.wasTruncated).toBe(false);
    });

    it('should return single chunk for text smaller than chunk size', () => {
      const text = 'Short text';
      const result = chunkText(text);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(text);
      expect(result.chunks[0].chunkIndex).toBe(0);
      expect(result.chunks[0].startOffset).toBe(0);
      expect(result.chunks[0].endOffset).toBe(text.length);
      expect(result.wasTruncated).toBe(false);
    });

    it('should split large text into multiple chunks', () => {
      // Create text larger than default chunk size (2000 chars)
      const text = 'a'.repeat(5000);
      const result = chunkText(text);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.totalCharacters).toBe(5000);
      expect(result.wasTruncated).toBe(false);
    });

    it('should apply overlap between chunks', () => {
      const config = {
        chunkSizeTokens: 10, // 40 chars
        overlapTokens: 2, // 8 chars
        maxChunks: 50,
      };

      const text = 'a'.repeat(100);
      const result = chunkText(text, config);

      // With 40 char chunks and 8 char overlap, step size is 32 chars
      // Chunk 0: 0-40
      // Chunk 1: 32-72 (overlaps with chunk 0 by 8 chars)
      // Chunk 2: 64-100 (overlaps with chunk 1 by 8 chars)
      expect(result.chunks.length).toBeGreaterThan(1);

      // Check overlap exists
      if (result.chunks.length >= 2) {
        const chunk0End = result.chunks[0].endOffset;
        const chunk1Start = result.chunks[1].startOffset;
        expect(chunk1Start).toBeLessThan(chunk0End);
      }
    });

    it('should enforce maxChunks limit', () => {
      const config = {
        chunkSizeTokens: 10, // 40 chars
        overlapTokens: 2, // 8 chars
        maxChunks: 3,
      };

      const text = 'a'.repeat(1000);
      const result = chunkText(text, config);

      expect(result.chunks).toHaveLength(3);
      expect(result.wasTruncated).toBe(true);
    });

    it('should normalize whitespace', () => {
      const text = 'line1\r\nline2\rline3\tword';
      const result = chunkText(text);

      expect(result.chunks[0].content).toBe('line1\nline2\nline3 word');
    });

    it('should throw error if overlap >= chunk size', () => {
      const config = {
        chunkSizeTokens: 10,
        overlapTokens: 10, // Same as chunk size
        maxChunks: 50,
      };

      expect(() => chunkText('test text', config)).toThrow(
        'Invalid chunk configuration: overlap (10 tokens) must be less than chunk size (10 tokens)',
      );
    });

    it('should assign sequential chunk indices', () => {
      const text = 'a'.repeat(5000);
      const result = chunkText(text);

      result.chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
      });
    });
  });

  describe('validateAttachmentContent', () => {
    it('should pass for valid content', () => {
      expect(() => validateAttachmentContent('Valid content')).not.toThrow();
    });

    it('should throw error for empty content', () => {
      expect(() => validateAttachmentContent('')).toThrow(
        'Attachment content cannot be empty',
      );
    });

    it('should throw error for whitespace-only content', () => {
      expect(() => validateAttachmentContent('   ')).toThrow(
        'Attachment content cannot be empty',
      );
    });

    it('should throw error for content exceeding max size', () => {
      const largeContent = 'a'.repeat(1_000_001);

      expect(() => validateAttachmentContent(largeContent)).toThrow(
        'Attachment content too large',
      );
    });

    it('should respect custom max size', () => {
      const content = 'a'.repeat(100);

      expect(() => validateAttachmentContent(content, 50)).toThrow(
        'Attachment content too large',
      );
    });
  });

  describe('estimateEmbeddingCost', () => {
    it('should calculate cost based on total tokens', () => {
      const result = chunkText('a'.repeat(4000)); // ~1000 tokens

      const cost = estimateEmbeddingCost(result);

      // Cost should be approximately $0.00002 per 1K tokens
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01); // Sanity check
    });
  });

  describe('getChunkingStats', () => {
    it('should return formatted statistics', () => {
      const result = chunkText('a'.repeat(5000));

      const stats = getChunkingStats(result);

      expect(stats).toContain('Chunks:');
      expect(stats).toContain('Total chars:');
      expect(stats).toContain('Est. tokens:');
      expect(stats).toContain('Avg chunk size:');
      expect(stats).toContain('Truncated: NO');
      expect(stats).toContain('Est. cost:');
    });
  });
});

