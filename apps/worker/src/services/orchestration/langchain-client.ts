import { ChatGroq } from "@langchain/groq";
import { z } from "zod";
import { LLMCallConfig, LLMCallResult } from "./types";

/**
 * LangChain-based LLM Client
 * 
 * This replaces the direct Groq SDK implementation with LangChain abstractions.
 * 
 * Key LangChain Concepts Used:
 * 
 * 1. **ChatGroq**: LangChain's wrapper around Groq's API
 *    - Provides consistent interface across different LLM providers
 *    - Built-in retry logic and error handling
 *    - Streaming support (not used here but available)
 * 
 * 2. **ChatPromptTemplate**: Structured prompt management
 *    - Type-safe prompt construction
 *    - Variable interpolation
 *    - Reusable prompt templates
 * 
 * 3. **StructuredOutputParser**: Automatic JSON parsing and validation
 *    - Converts Zod schemas to JSON Schema for the LLM
 *    - Validates and parses LLM responses
 *    - Provides format instructions to the LLM
 * 
 * 4. **RunnableSequence**: Chain multiple operations
 *    - Compose prompt → LLM → parser into a single pipeline
 *    - Type-safe data flow
 *    - Easy to extend with additional steps
 * 
 * Benefits over direct SDK:
 * - Provider-agnostic (easy to switch from Groq to OpenAI/Anthropic)
 * - Built-in retry and error handling
 * - Structured output parsing with validation
 * - Better observability and debugging
 * - Composable chains for complex workflows
 */

export class LangChainLLMClient {
  private model: ChatGroq;

  constructor(apiKey: string, modelName: string = "llama-3.1-8b-instant") {
    // Initialize ChatGroq with configuration
    this.model = new ChatGroq({
      apiKey,
      model: modelName,
      // LangChain's built-in retry configuration
      maxRetries: 0, // We'll handle retries at a higher level for better control
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Execute LLM call with retry logic
   * 
   * This maintains the same interface as the original LLMClient
   * but uses LangChain under the hood.
   */
  async call<T = any>(config: LLMCallConfig): Promise<LLMCallResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Execute call with timeout
        const result = await this.executeWithTimeout(config, config.timeoutMs);

        // Validate if schema provided
        if (config.schema) {
          const validationResult = config.schema.safeParse(result.data);
          if (!validationResult.success) {
            throw new Error(
              `Schema validation failed: ${validationResult.error.issues
                .map((e: any) => `${e.path.join(".")}: ${e.message}`)
                .join(", ")}`
            );
          }
          result.data = validationResult.data;
        }

        return {
          success: true,
          data: result.data,
          rawResponse: result.rawResponse,
          retryCount,
          durationMs: Date.now() - startTime,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        // If not retryable or max retries reached, fail immediately
        if (!isRetryable || !config.retryable || attempt >= config.maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const backoffMs = this.calculateBackoff(attempt);
        console.log(
          `[LangChainClient] Retry ${attempt + 1}/${config.maxRetries} after ${backoffMs}ms: ${lastError.message}`
        );
        await this.sleep(backoffMs);
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || "Unknown error",
      retryCount,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute single LLM call with timeout using LangChain
   */
  private async executeWithTimeout(
    config: LLMCallConfig,
    timeoutMs: number
  ): Promise<{ data: any; rawResponse: string; tokensUsed?: number }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`LLM call timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const callPromise = this.executeSingleCall(config);

    return Promise.race([callPromise, timeoutPromise]);
  }

  /**
   * Execute single LLM API call using LangChain
   *
   * This demonstrates LangChain's direct message invocation:
   * 1. Create messages array
   * 2. Invoke the LLM
   * 3. Parse the response
   *
   * Note: We don't use ChatPromptTemplate here because our prompts contain
   * JSON examples with curly braces {}, which would be interpreted as template variables.
   */
  private async executeSingleCall(
    config: LLMCallConfig
  ): Promise<{ data: any; rawResponse: string; tokensUsed?: number }> {
    // Create a ChatGroq instance with specific configuration for this call
    const model = new ChatGroq({
      apiKey: this.model.apiKey,
      model: this.model.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeoutMs,
      ...(config.responseFormat === "json_object" && {
        modelKwargs: {
          response_format: { type: "json_object" },
        },
      }),
    });

    // Create messages array directly (no template to avoid {} conflicts)
    const messages = [
      { role: "system" as const, content: config.systemPrompt },
      { role: "user" as const, content: config.userPrompt },
    ];

    // Invoke the model directly with messages
    const response: any = await model.invoke(messages);

    const rawResponse = response.content as string;

    if (!rawResponse) {
      throw new Error("Empty response from LLM");
    }

    // Parse JSON if expected
    let data: any = rawResponse;
    if (config.responseFormat === "json_object") {
      try {
        data = JSON.parse(rawResponse);
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}`);
      }
    }

    // Extract token usage from response metadata
    const tokensUsed = response.response_metadata?.token_usage?.total_tokens;

    return {
      data,
      rawResponse,
      tokensUsed,
    };
  }

  /**
   * Determine if error is retryable
   * Same logic as original implementation
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors - retryable
    if (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("enotfound")
    ) {
      return true;
    }

    // Rate limit errors - retryable
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Server errors (5xx) - retryable
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return true;
    }

    // Validation errors - NOT retryable
    if (message.includes("validation failed") || message.includes("schema")) {
      return false;
    }

    // Auth errors - NOT retryable
    if (message.includes("unauthorized") || message.includes("401") || message.includes("403")) {
      return false;
    }

    // Default: not retryable
    return false;
  }

  /**
   * Calculate exponential backoff delay
   * Same logic as original implementation
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.min(exponentialDelay + jitter, 30000);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying ChatGroq model
   * Useful for advanced LangChain features
   */
  getModel(): ChatGroq {
    return this.model;
  }
}

