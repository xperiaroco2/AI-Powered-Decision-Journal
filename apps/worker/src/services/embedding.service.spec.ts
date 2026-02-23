/**
 * Embedding Service Unit Tests
 *
 * Tests the embedding provider factory, singleton pattern, and text preparation.
 */

describe('Embedding Service', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let getEmbeddingProvider: any;
  let prepareDecisionTextForEmbedding: any;
  let MockEmbeddingProvider: any;
  let OpenAIEmbeddingProvider: any;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache to reset singleton
    jest.resetModules();

    // Dynamically import the module to get fresh instance
    const embeddingService = await import('./embedding.service');
    getEmbeddingProvider = embeddingService.getEmbeddingProvider;
    prepareDecisionTextForEmbedding = embeddingService.prepareDecisionTextForEmbedding;
    MockEmbeddingProvider = embeddingService.MockEmbeddingProvider;
    OpenAIEmbeddingProvider = embeddingService.OpenAIEmbeddingProvider;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getEmbeddingProvider', () => {
    it('should return MockEmbeddingProvider when EMBEDDING_PROVIDER is not set', () => {
      delete process.env.EMBEDDING_PROVIDER;

      const provider = getEmbeddingProvider();

      expect(provider).toBeInstanceOf(MockEmbeddingProvider);
    });

    it('should return MockEmbeddingProvider when EMBEDDING_PROVIDER is "mock"', () => {
      process.env.EMBEDDING_PROVIDER = 'mock';

      const provider = getEmbeddingProvider();

      expect(provider).toBeInstanceOf(MockEmbeddingProvider);
    });

    it('should return OpenAIEmbeddingProvider when EMBEDDING_PROVIDER is "openai" and API key is set', () => {
      process.env.EMBEDDING_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test-api-key';

      const provider = getEmbeddingProvider();

      expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
    });

    it('should fallback to MockEmbeddingProvider when EMBEDDING_PROVIDER is "openai" but API key is missing', () => {
      process.env.EMBEDDING_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const provider = getEmbeddingProvider();

      expect(provider).toBeInstanceOf(MockEmbeddingProvider);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OPENAI_API_KEY is required'),
      );

      consoleSpy.mockRestore();
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      process.env.EMBEDDING_PROVIDER = 'mock';

      const provider1 = getEmbeddingProvider();
      const provider2 = getEmbeddingProvider();

      expect(provider1).toBe(provider2);
    });
  });

  describe('MockEmbeddingProvider', () => {
    let provider: any;

    beforeEach(() => {
      provider = new MockEmbeddingProvider();
    });

    it('should generate 1536-dimensional embeddings', async () => {
      const embedding = await provider.generateEmbedding('test text');

      expect(embedding).toHaveLength(1536);
      expect(embedding.every((val: any) => typeof val === 'number')).toBe(true);
    });

    it('should generate deterministic embeddings for the same text', async () => {
      const text = 'Should I switch jobs?';

      const embedding1 = await provider.generateEmbedding(text);
      const embedding2 = await provider.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await provider.generateEmbedding('text 1');
      const embedding2 = await provider.generateEmbedding('text 2');

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should throw error for empty text', async () => {
      await expect(provider.generateEmbedding('')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      );
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(provider.generateEmbedding('   ')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      );
    });

    it('should return correct model name', () => {
      expect(provider.getModelName()).toBe('mock-embedding');
    });
  });

  describe('prepareDecisionTextForEmbedding', () => {
    it('should combine all decision fields', () => {
      const decision = {
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes, I will switch',
        personalReasoning: 'Better salary and work-life balance',
      };

      const text = prepareDecisionTextForEmbedding(decision);

      expect(text).toContain('Situation: Should I switch jobs?');
      expect(text).toContain('Decision: Yes, I will switch');
      expect(text).toContain('Reasoning: Better salary and work-life balance');
    });

    it('should handle null personalReasoning', () => {
      const decision = {
        situation: 'Should I buy a house?',
        chosenDecision: 'Yes',
        personalReasoning: null,
      };

      const text = prepareDecisionTextForEmbedding(decision);

      expect(text).toContain('Situation: Should I buy a house?');
      expect(text).toContain('Decision: Yes');
      expect(text).not.toContain('Reasoning:');
    });
  });
});

