import Groq from 'groq-sdk';
import { LLMCallConfig, LLMCallResult } from './types';
import { childLogger } from '../../logger';

const log = childLogger('llm-client');

/**
 * LLM Client with Retry Logic
 *
 * Handles all LLM API calls with:
 * - Exponential backoff retry
 * - Structured output validation
 * - Timeout handling
 * - Error classification (retryable vs non-retryable)
 */

export class LLMClient {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  /**
   * Execute LLM call with retry logic
   */
  async call<T = unknown>(config: LLMCallConfig): Promise<LLMCallResult<T>> {
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
                .map(
                  (e) => `${e.path.map(String).join('.')}: ${e.message}`,
                )
                .join(', ')}`,
            );
          }
          result.data = validationResult.data;
        }

        return {
          success: true,
          data: result.data as T,
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
        log.info(
          {
            attempt: attempt + 1,
            maxRetries: config.maxRetries,
            backoffMs,
            err: lastError.message,
          },
          'Retry',
        );
        await this.sleep(backoffMs);
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute single LLM call with timeout
   */
  private async executeWithTimeout(
    config: LLMCallConfig,
    timeoutMs: number,
  ): Promise<{ data: unknown; rawResponse: string; tokensUsed?: number }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`LLM call timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    const callPromise = this.executeSingleCall(config);

    return Promise.race([callPromise, timeoutPromise]);
  }

  /**
   * Execute single LLM API call
   */
  private async executeSingleCall(
    config: LLMCallConfig,
  ): Promise<{ data: unknown; rawResponse: string; tokensUsed?: number }> {
    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: config.userPrompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format:
        config.responseFormat === 'json_object'
          ? { type: 'json_object' }
          : undefined,
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('Empty response from LLM');
    }

    // Parse JSON if expected
    let data: unknown = rawResponse;
    if (config.responseFormat === 'json_object') {
      try {
        data = JSON.parse(rawResponse);
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}`);
      }
    }

    return {
      data,
      rawResponse,
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors - retryable
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // Rate limit errors - retryable
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Server errors (5xx) - retryable
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return true;
    }

    // Validation errors - NOT retryable
    if (message.includes('validation failed') || message.includes('schema')) {
      return false;
    }

    // Auth errors - NOT retryable
    if (
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return false;
    }

    // Default: not retryable
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    // Base delay: 1 second
    // Exponential: 1s, 2s, 4s, 8s, 16s
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Add jitter (±20%)
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);

    // Cap at 30 seconds
    return Math.min(exponentialDelay + jitter, 30000);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
