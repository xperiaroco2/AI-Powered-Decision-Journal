import { PrismaClient } from "@prisma/client";
import { AIProvider, DecisionInput, AnalysisResult } from "./providers/types";
import { MockProvider } from "./providers/mock.provider";
import { GroqProvider } from "./providers/groq.provider";
import { childLogger } from "../logger";

const log = childLogger('ai-service');

/**
 * AI Service Factory
 *
 * Creates the appropriate AI provider based on AI_PROVIDER environment variable.
 *
 * Supported providers:
 * - mock: Always works, no API key needed (default)
 * - groq: Production-grade orchestration with multi-step workflow
 */

type ProviderType = "mock" | "groq";

const prisma = new PrismaClient();

function getProviderType(): ProviderType {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  if (provider === "groq") {
    return "groq";
  }

  // Default to mock
  return "mock";
}

function createProvider(): AIProvider {
  const providerType = getProviderType();

  log.info({ providerType }, 'AI Provider');

  switch (providerType) {
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        log.error('GROQ_API_KEY is required when AI_PROVIDER=groq');
        log.error('Falling back to mock provider');
        return new MockProvider();
      }
      return new GroqProvider(apiKey, prisma);
    }

    case "mock":
    default:
      return new MockProvider();
  }
}

// Singleton provider instance
let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = createProvider();
  }
  return providerInstance;
}

/**
 * Analyze a decision using the configured AI provider
 */
export async function analyzeDecision(input: DecisionInput): Promise<AnalysisResult> {
  const provider = getAIProvider();
  return provider.analyze(input);
}

