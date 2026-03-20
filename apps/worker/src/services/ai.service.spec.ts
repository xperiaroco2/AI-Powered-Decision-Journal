/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Service Unit Tests
 *
 * Tests the AI provider factory and singleton pattern.
 */

// Mock the providers
jest.mock('./providers/mock.provider');
jest.mock('./providers/groq.provider');

describe('AI Service', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let getAIProvider: any;
  let _analyzeDecision: any;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all mocks
    jest.clearAllMocks();

    // Clear module cache to reset singleton
    jest.resetModules();

    // Dynamically import the module to get fresh instance
    const aiService = await import('./ai.service');
    getAIProvider = aiService.getAIProvider;
    _analyzeDecision = aiService.analyzeDecision;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getAIProvider', () => {
    it('should return MockProvider when AI_PROVIDER is not set', () => {
      delete process.env.AI_PROVIDER;

      const provider = getAIProvider();

      expect(provider.constructor.name).toBe('MockProvider');
    });

    it('should return MockProvider when AI_PROVIDER is "mock"', () => {
      process.env.AI_PROVIDER = 'mock';

      const provider = getAIProvider();

      expect(provider.constructor.name).toBe('MockProvider');
    });

    it('should return GroqProvider when AI_PROVIDER is "groq" and API key is set', () => {
      process.env.AI_PROVIDER = 'groq';
      process.env.GROQ_API_KEY = 'test-api-key';

      const provider = getAIProvider();

      expect(provider.constructor.name).toBe('GroqProvider');
    });

    it('should fallback to MockProvider when AI_PROVIDER is "groq" but API key is missing', () => {
      process.env.AI_PROVIDER = 'groq';
      delete process.env.GROQ_API_KEY;

      const provider = getAIProvider();

      expect(provider.constructor.name).toBe('MockProvider');
    });

    it('should handle case-insensitive provider names', () => {
      process.env.AI_PROVIDER = 'MOCK';

      const provider = getAIProvider();

      expect(provider.constructor.name).toBe('MockProvider');
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      process.env.AI_PROVIDER = 'mock';

      const provider1 = getAIProvider();
      const provider2 = getAIProvider();

      expect(provider1).toBe(provider2);
    });
  });

  describe('analyzeDecision', () => {
    it('should call the provider analyze method', async () => {
      process.env.AI_PROVIDER = 'mock';

      const mockAnalyze = jest.fn().mockResolvedValue({
        category: 'CAREER',
        cognitiveBiases: [],
        missedAlternatives: [],
        insights: [],
        rawAiResponse: 'test',
      });

      // Re-import the module to get a fresh instance
      jest.resetModules();

      // Mock the MockProvider constructor AFTER resetting modules
      const { MockProvider: MockProviderFresh } =
        await import('./providers/mock.provider');
      (
        MockProviderFresh as jest.MockedClass<typeof MockProviderFresh>
      ).mockImplementation(
        () =>
          ({
            analyze: mockAnalyze,
            setContext: jest.fn(),
          }) as any,
      );

      const aiService = await import('./ai.service');
      const analyzeDecisionFresh = aiService.analyzeDecision;

      const input = {
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes',
        personalReasoning: 'Better salary',
      };

      await analyzeDecisionFresh(input);

      expect(mockAnalyze).toHaveBeenCalledWith(input);
    });

    it('should return the analysis result from the provider', async () => {
      process.env.AI_PROVIDER = 'mock';

      const expectedResult = {
        category: 'FINANCIAL' as const,
        cognitiveBiases: [{ name: 'Anchoring', description: 'Test' }],
        missedAlternatives: ['Alternative 1'],
        insights: ['Insight 1'],
        rawAiResponse: 'test response',
      };

      const mockAnalyze = jest.fn().mockResolvedValue(expectedResult);

      // Re-import the module to get a fresh instance
      jest.resetModules();

      // Mock the MockProvider constructor AFTER resetting modules
      const { MockProvider: MockProviderFresh } =
        await import('./providers/mock.provider');
      (
        MockProviderFresh as jest.MockedClass<typeof MockProviderFresh>
      ).mockImplementation(
        () =>
          ({
            analyze: mockAnalyze,
            setContext: jest.fn(),
          }) as any,
      );

      const aiService = await import('./ai.service');
      const analyzeDecisionFresh = aiService.analyzeDecision;

      const input = {
        situation: 'Should I buy a house?',
        chosenDecision: 'Yes',
        personalReasoning: null,
      };

      const result = await analyzeDecisionFresh(input);

      expect(result).toEqual(expectedResult);
    });
  });
});
