import {
  AIProvider,
  DecisionInput,
  AnalysisResult,
  VALID_CATEGORIES,
} from './types';

/**
 * Mock AI Provider
 *
 * Always works without API keys.
 * Simulates processing time and returns realistic placeholder data.
 * Perfect for development and demo environments.
 */
export class MockProvider implements AIProvider {
  async analyze(_input: DecisionInput): Promise<AnalysisResult> {
    // Simulate processing time (0.5-2 seconds)
    const processingTime = 500 + Math.random() * 1500;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Pick a random category
    const category =
      VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)];

    // Generate mock analysis
    const cognitiveBiases = [
      {
        name: 'Confirmation Bias',
        description:
          'Tendency to search for or interpret information in a way that confirms preconceptions',
      },
      {
        name: 'Anchoring Bias',
        description:
          'Over-reliance on the first piece of information encountered when making decisions',
      },
    ];

    const missedAlternatives = [
      'Consider a hybrid approach combining elements from different options',
      'Delay the decision to gather more information',
      'Consult with domain experts before finalizing',
    ];

    const insights = [
      'Your reasoning shows careful consideration of long-term implications',
      'Consider potential emotional factors that may not be fully addressed',
      'Document your decision criteria for future reference',
    ];

    const rawAiResponse = JSON.stringify({
      provider: 'mock',
      timestamp: new Date().toISOString(),
      category,
      cognitiveBiases,
      missedAlternatives,
      insights,
    });

    return {
      category,
      cognitiveBiases,
      missedAlternatives,
      insights,
      rawAiResponse,
    };
  }
}
