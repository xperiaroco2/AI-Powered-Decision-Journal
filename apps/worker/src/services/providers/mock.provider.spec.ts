/**
 * Mock Provider Unit Tests
 *
 * Tests the mock AI provider for development and testing.
 */

import { MockProvider } from './mock.provider';
import { VALID_CATEGORIES } from './types';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('analyze', () => {
    it('should return analysis result with all required fields', async () => {
      const input = {
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes, I will switch',
        personalReasoning: 'Better salary and work-life balance',
      };

      const result = await provider.analyze(input);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('cognitiveBiases');
      expect(result).toHaveProperty('missedAlternatives');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('rawAiResponse');
    });

    it('should return a valid category', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(VALID_CATEGORIES).toContain(result.category);
    });

    it('should return cognitive biases array', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(Array.isArray(result.cognitiveBiases)).toBe(true);
      expect(result.cognitiveBiases.length).toBeGreaterThan(0);

      result.cognitiveBiases.forEach((bias) => {
        expect(bias).toHaveProperty('name');
        expect(bias).toHaveProperty('description');
        expect(typeof bias.name).toBe('string');
        expect(typeof bias.description).toBe('string');
      });
    });

    it('should return missed alternatives array', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(Array.isArray(result.missedAlternatives)).toBe(true);
      expect(result.missedAlternatives.length).toBeGreaterThan(0);

      result.missedAlternatives.forEach((alternative) => {
        expect(typeof alternative).toBe('string');
      });
    });

    it('should return insights array', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.insights.length).toBeGreaterThan(0);

      result.insights.forEach((insight) => {
        expect(typeof insight).toBe('string');
      });
    });

    it('should return valid JSON in rawAiResponse', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(() => JSON.parse(result.rawAiResponse)).not.toThrow();

      const parsed = JSON.parse(result.rawAiResponse);
      expect(parsed).toHaveProperty('provider', 'mock');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('category');
      expect(parsed).toHaveProperty('cognitiveBiases');
      expect(parsed).toHaveProperty('missedAlternatives');
      expect(parsed).toHaveProperty('insights');
    });

    it('should simulate processing time (500-2000ms)', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const startTime = Date.now();
      await provider.analyze(input);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should take at least 500ms
      expect(duration).toBeGreaterThanOrEqual(500);

      // Should take less than 2500ms (2000ms + 500ms buffer)
      expect(duration).toBeLessThan(2500);
    }, 10000); // Increase test timeout to 10 seconds

    it('should handle null personalReasoning', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: null,
      };

      const result = await provider.analyze(input);

      expect(result).toHaveProperty('category');
      expect(result.cognitiveBiases.length).toBeGreaterThan(0);
    });

    it('should return consistent structure across multiple calls', async () => {
      const input = {
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        personalReasoning: 'Test reasoning',
      };

      const result1 = await provider.analyze(input);
      const result2 = await provider.analyze(input);

      // Structure should be the same
      expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort());
      expect(result1.cognitiveBiases.length).toBe(result2.cognitiveBiases.length);
      expect(result1.missedAlternatives.length).toBe(result2.missedAlternatives.length);
      expect(result1.insights.length).toBe(result2.insights.length);
    }, 10000); // Increase test timeout
  });
});

