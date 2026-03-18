import { VALID_CATEGORIES } from '../providers/types';
import { UserContext } from './types';

/**
 * Prompt Templates
 *
 * Centralized prompt management with clear separation between:
 * - Deterministic steps (low temperature)
 * - Creative steps (higher temperature)
 */

export class PromptBuilder {
  /**
   * Step 1: Initial Analysis (Deterministic)
   * Temperature: 0.3
   */
  buildInitialAnalysisPrompt(
    situation: string,
    decision: string,
    reasoning: string | null,
    userContext: UserContext | null,
  ): { system: string; user: string } {
    const system = `You are an expert decision analyst specializing in cognitive bias detection and strategic thinking.

Your task: Perform an initial structured analysis of a user's decision.

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Required JSON structure:
{
  "category": "<one of: ${VALID_CATEGORIES.join(', ')}>",
  "cognitiveBiases": [
    {
      "name": "<bias name>",
      "description": "<how this bias influenced the decision>",
      "severity": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "missedAlternatives": [
    {
      "alternative": "<alternative option>",
      "reasoning": "<why this wasn't considered>",
      "feasibility": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "preliminaryInsights": [
    "<insight or observation>"
  ]
}

Guidelines:
- Identify 2-4 cognitive biases with severity levels
- Suggest 2-4 missed alternatives with feasibility assessment
- Provide 3-5 preliminary insights
- Be objective and evidence-based
- Category MUST be one of the exact values listed above`;

    let user = `Analyze this decision:\n\n`;
    user += `SITUATION:\n${situation}\n\n`;
    user += `DECISION MADE:\n${decision}\n\n`;
    if (reasoning) {
      user += `USER'S REASONING:\n${reasoning}\n\n`;
    }

    // Add user context if available
    if (userContext && userContext.patterns.decisionCount > 0) {
      user += `\n${this.formatUserContext(userContext)}\n\n`;
    }

    user += `Provide your analysis in the exact JSON format specified.`;

    return { system, user };
  }

  /**
   * Step 2: Reflection (Creative)
   * Temperature: 0.7
   */
  buildReflectionPrompt(
    initialAnalysis: unknown,
    _situation: string,
    decision: string,
  ): { system: string; user: string } {
    const system = `You are a meta-analyst reviewing decision analysis quality.

Your task: Critically evaluate an initial analysis and identify gaps or improvements.

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Required JSON structure:
{
  "analysisQuality": "<POOR | FAIR | GOOD | EXCELLENT>",
  "missingPerspectives": [
    "<perspective that wasn't considered>"
  ],
  "additionalBiases": [
    {
      "name": "<bias name>",
      "description": "<description>",
      "severity": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "refinementSuggestions": [
    "<suggestion for improving the analysis>"
  ]
}

Guidelines:
- Be critical but constructive
- Look for blind spots in the initial analysis
- Consider alternative interpretations
- Identify any biases that were missed
- Suggest 1-3 refinements`;

    const user = `Review this decision analysis:\n\n`;
    const userContent = `ORIGINAL DECISION:\n${decision}\n\n`;
    const userContent2 = `INITIAL ANALYSIS:\n${JSON.stringify(initialAnalysis, null, 2)}\n\n`;
    const userContent3 = `Provide your meta-analysis in the exact JSON format specified.`;

    return { system, user: user + userContent + userContent2 + userContent3 };
  }

  /**
   * Step 3: Final Synthesis (Balanced)
   * Temperature: 0.5
   */
  buildFinalSynthesisPrompt(
    situation: string,
    decision: string,
    reasoning: string | null,
    initialAnalysis: unknown,
    reflection: unknown,
    userContext: UserContext | null,
  ): { system: string; user: string } {
    const system = `You are an expert decision analyst producing a final comprehensive analysis.

Your task: Synthesize initial analysis and reflection into a refined final output.

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Required JSON structure:
{
  "category": "<one of: ${VALID_CATEGORIES.join(', ')}>",
  "cognitiveBiases": [
    {
      "name": "<bias name>",
      "description": "<how this bias influenced the decision>",
      "severity": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "missedAlternatives": [
    {
      "alternative": "<alternative option>",
      "reasoning": "<why this wasn't considered>",
      "feasibility": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "insights": [
    {
      "type": "<STRENGTH | WEAKNESS | RECOMMENDATION | RISK>",
      "content": "<insight content>",
      "priority": "<LOW | MEDIUM | HIGH>"
    }
  ],
  "confidence": <0.0 to 1.0>
}

Guidelines:
- Incorporate feedback from the reflection step
- Refine biases and alternatives based on meta-analysis
- Provide 4-8 structured insights with types and priorities
- Include a confidence score (0.0-1.0) for your analysis
- Be comprehensive but concise`;

    let user = `Synthesize the final analysis:\n\n`;
    user += `ORIGINAL DECISION:\n`;
    user += `Situation: ${situation}\n`;
    user += `Decision: ${decision}\n`;
    if (reasoning) {
      user += `Reasoning: ${reasoning}\n`;
    }
    user += `\n`;

    user += `INITIAL ANALYSIS:\n${JSON.stringify(initialAnalysis, null, 2)}\n\n`;
    user += `REFLECTION:\n${JSON.stringify(reflection, null, 2)}\n\n`;

    if (userContext && userContext.patterns.decisionCount > 0) {
      user += `${this.formatUserContext(userContext)}\n\n`;
    }

    user += `Provide your final synthesis in the exact JSON format specified.`;

    return { system, user };
  }

  /**
   * Format user context for prompts
   */
  private formatUserContext(context: UserContext): string {
    const { patterns, recentDecisions } = context;

    let prompt = `USER CONTEXT:\n`;
    prompt += `- Total decisions analyzed: ${patterns.decisionCount}\n`;

    if (patterns.commonCategories.length > 0) {
      prompt += `- Common decision areas: ${patterns.commonCategories.join(', ')}\n`;
    }

    if (patterns.frequentBiases.length > 0) {
      prompt += `- Recurring cognitive biases: ${patterns.frequentBiases.join(', ')}\n`;
      prompt += `  → Pay special attention to these patterns\n`;
    }

    if (recentDecisions.length > 0) {
      prompt += `\nRECENT DECISIONS:\n`;
      recentDecisions.slice(0, 3).forEach((d, i) => {
        prompt += `${i + 1}. ${d.category} decision`;
        if (d.biases.length > 0) {
          prompt += ` (biases: ${d.biases.slice(0, 2).join(', ')})`;
        }
        prompt += `\n`;
      });
    }

    return prompt;
  }
}
