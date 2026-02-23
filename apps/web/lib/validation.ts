/**
 * Client-side validation utilities
 *
 * Simple validation functions for form inputs.
 * Server-side validation is handled by DTOs in NestJS.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Count words in a string
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate email format
 * Matches server-side validation in RegisterDto and LoginDto
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: "Email is required",
    };
  }

  // Basic email regex - matches most common email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid email address",
    };
  }

  return { isValid: true };
}

/**
 * Validate password strength
 * Matches server-side validation in RegisterDto and LoginDto (min 6 characters)
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return {
      isValid: false,
      error: "Password is required",
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: "Password must be at least 6 characters",
    };
  }

  return { isValid: true };
}

/**
 * Validate situation field
 */
export function validateSituation(situation: string): ValidationResult {
  const trimmed = situation.trim();
  const wordCount = countWords(trimmed);

  if (!trimmed) {
    return {
      isValid: false,
      error: "Situation is required",
    };
  }

  if (wordCount < 10) {
    return {
      isValid: true,
      warning: `Too brief (${wordCount} words). Aim for 10+ words for better AI analysis.`,
    };
  }

  if (wordCount > 500) {
    return {
      isValid: false,
      error: "Situation is too long (max 500 words)",
    };
  }

  return { isValid: true };
}

/**
 * Validate decision field
 */
export function validateDecision(decision: string): ValidationResult {
  const trimmed = decision.trim();
  const wordCount = countWords(trimmed);

  if (!trimmed) {
    return {
      isValid: false,
      error: "Decision is required",
    };
  }

  if (wordCount < 3) {
    return {
      isValid: true,
      warning: `Too brief (${wordCount} words). Aim for 3+ words.`,
    };
  }

  if (wordCount > 100) {
    return {
      isValid: false,
      error: "Decision is too long (max 100 words)",
    };
  }

  return { isValid: true };
}

/**
 * Validate reasoning field
 */
export function validateReasoning(reasoning: string): ValidationResult {
  const trimmed = reasoning.trim();
  const wordCount = countWords(trimmed);

  if (!trimmed) {
    return {
      isValid: false,
      error: "Reasoning is required",
    };
  }

  if (wordCount < 10) {
    return {
      isValid: true,
      warning: `Too brief (${wordCount} words). Aim for 10+ words for better AI analysis.`,
    };
  }

  if (wordCount > 500) {
    return {
      isValid: false,
      error: "Reasoning is too long (max 500 words)",
    };
  }

  return { isValid: true };
}

