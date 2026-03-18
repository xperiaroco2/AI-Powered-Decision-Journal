import { DecisionInputSchema } from './types';

/**
 * Semantic Input Validator
 *
 * Validates input quality beyond schema validation.
 * Checks for:
 * - Sufficient detail
 * - Coherence
 * - Actionable content
 * - No spam/gibberish
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  quality: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class InputValidator {
  /**
   * Validate decision input semantically
   */
  validate(input: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Schema validation
    const schemaResult = DecisionInputSchema.safeParse(input);
    if (!schemaResult.success) {
      return {
        valid: false,
        errors: schemaResult.error.issues.map(
          (e: { path: Array<string | number>; message: string }) =>
            `${e.path.join('.')}: ${e.message}`,
        ),
        warnings: [],
        quality: 'LOW',
      };
    }

    const data = schemaResult.data;

    // 2. Semantic validation
    const situationQuality = this.validateSituation(data.situation);
    const decisionQuality = this.validateDecision(data.chosenDecision);
    const reasoningQuality = data.personalReasoning
      ? this.validateReasoning(data.personalReasoning)
      : { errors: [], warnings: [], quality: 'MEDIUM' as const };

    errors.push(
      ...situationQuality.errors,
      ...decisionQuality.errors,
      ...reasoningQuality.errors,
    );
    warnings.push(
      ...situationQuality.warnings,
      ...decisionQuality.warnings,
      ...reasoningQuality.warnings,
    );

    // 3. Cross-field validation
    if (
      data.situation.toLowerCase().includes(data.chosenDecision.toLowerCase())
    ) {
      warnings.push(
        'Decision text appears to be copy-pasted from situation - consider being more specific',
      );
    }

    // 4. Determine overall quality
    const quality = this.determineQuality(
      situationQuality,
      decisionQuality,
      reasoningQuality,
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      quality,
    };
  }

  private validateSituation(situation: string): {
    errors: string[];
    warnings: string[];
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for gibberish (too many repeated characters)
    if (/(.)\1{4,}/.test(situation)) {
      errors.push(
        'Situation contains repeated characters - appears to be gibberish',
      );
    }

    // Check for minimum word count
    const wordCount = situation.split(/\s+/).length;
    if (wordCount < 10) {
      errors.push(
        'Situation is too brief - provide at least 10 words of context',
      );
    } else if (wordCount < 20) {
      warnings.push(
        'Situation is brief - more context would improve analysis quality',
      );
    }

    // Check for question marks (indicates uncertainty about what to provide)
    const questionCount = (situation.match(/\?/g) || []).length;
    if (questionCount > 3) {
      warnings.push(
        'Situation contains many questions - focus on describing the context',
      );
    }

    // Check for URLs (spam indicator)
    if (/https?:\/\//.test(situation)) {
      warnings.push(
        'Situation contains URLs - ensure this is relevant context',
      );
    }

    // Determine quality
    let quality: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (errors.length > 0) {
      quality = 'LOW';
    } else if (wordCount > 50 && questionCount <= 1) {
      quality = 'HIGH';
    }

    return { errors, warnings, quality };
  }

  private validateDecision(decision: string): {
    errors: string[];
    warnings: string[];
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for gibberish
    if (/(.)\1{4,}/.test(decision)) {
      errors.push(
        'Decision contains repeated characters - appears to be gibberish',
      );
    }

    // Check for minimum word count
    const wordCount = decision.split(/\s+/).length;
    if (wordCount < 5) {
      errors.push('Decision is too brief - provide at least 5 words');
    } else if (wordCount < 10) {
      warnings.push('Decision is brief - more detail would improve analysis');
    }

    // Check if it's actually a decision (should contain action verbs)
    const actionVerbs =
      /\b(decided|chose|will|going to|plan to|accepted|rejected|bought|sold|quit|started|stopped)\b/i;
    if (!actionVerbs.test(decision)) {
      warnings.push(
        "Decision doesn't clearly state what action was taken - consider rephrasing",
      );
    }

    // Determine quality
    let quality: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (errors.length > 0) {
      quality = 'LOW';
    } else if (wordCount > 15 && actionVerbs.test(decision)) {
      quality = 'HIGH';
    }

    return { errors, warnings, quality };
  }

  private validateReasoning(reasoning: string): {
    errors: string[];
    warnings: string[];
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for gibberish
    if (/(.)\1{4,}/.test(reasoning)) {
      errors.push(
        'Reasoning contains repeated characters - appears to be gibberish',
      );
    }

    // Check for minimum word count
    const wordCount = reasoning.split(/\s+/).length;
    if (wordCount < 5) {
      warnings.push(
        'Reasoning is very brief - more detail would improve analysis',
      );
    }

    // Determine quality
    let quality: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (errors.length > 0) {
      quality = 'LOW';
    } else if (wordCount > 30) {
      quality = 'HIGH';
    }

    return { errors, warnings, quality };
  }

  private determineQuality(
    situation: { quality: 'LOW' | 'MEDIUM' | 'HIGH' },
    decision: { quality: 'LOW' | 'MEDIUM' | 'HIGH' },
    reasoning: { quality: 'LOW' | 'MEDIUM' | 'HIGH' },
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const qualities = [situation.quality, decision.quality, reasoning.quality];

    // If any is LOW, overall is LOW
    if (qualities.includes('LOW')) {
      return 'LOW';
    }

    // If all are HIGH, overall is HIGH
    if (qualities.every((q) => q === 'HIGH')) {
      return 'HIGH';
    }

    // Otherwise MEDIUM
    return 'MEDIUM';
  }
}
