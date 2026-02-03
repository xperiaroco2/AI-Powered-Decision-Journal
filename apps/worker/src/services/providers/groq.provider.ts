import Groq from "groq-sdk";
import { AIProvider, DecisionInput, AnalysisResult, VALID_CATEGORIES } from "./types";

/**
 * Groq AI Provider
 * 
 * Uses Groq's free-tier API with Llama 3 8B model.
 * Fast inference (typically <1 second).
 * Requires GROQ_API_KEY environment variable.
 */
export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async analyze(input: DecisionInput): Promise<AnalysisResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    try {
      const completion = await this.client.chat.completions.create({
        model: "llama-3.1-8b-instant", // Production model, fast and free tier
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }, // Force JSON output
      });

      const rawResponse = completion.choices[0]?.message?.content;

      if (!rawResponse) {
        throw new Error("Empty response from Groq API");
      }

      // Parse and validate JSON
      const parsed = this.parseAndValidate(rawResponse);

      return {
        ...parsed,
        rawAiResponse: rawResponse,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Groq API error: ${error.message}`);
      }
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert decision analyst. Analyze decisions objectively and provide structured feedback.

            CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no code blocks, no extra text.
            
            Required JSON structure:
            {
              "category": "<one of: ${VALID_CATEGORIES.join(", ")}>",
              "cognitiveBiases": [
                {
                  "name": "<bias name>",
                  "description": "<how this bias influenced the decision>"
                }
              ],
              "missedAlternatives": [
                "<alternative option description>"
              ],
              "insights": [
                "<insight or suggestion>"
              ]
            }
            
            Guidelines:
            - Identify 2-3 cognitive biases
            - Suggest 2-3 missed alternatives
            - Provide 3-4 insights
            - Be objective and constructive
            - Category MUST be one of the exact values listed above`;
  }

  private buildUserPrompt(input: DecisionInput): string {
    return `Analyze this decision:

            SITUATION:
            ${input.situation}
            
            DECISION MADE:
            ${input.chosenDecision}
            
            ${input.personalReasoning ? `REASONING:\n${input.personalReasoning}\n` : ""}
            Provide analysis in the exact JSON format specified.`;
  }

  private parseAndValidate(rawResponse: string): Omit<AnalysisResult, "rawAiResponse"> {
    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(rawResponse);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }

    // Validate structure
    if (!data || typeof data !== "object") {
      throw new Error("Response is not a valid object");
    }

    // Validate category
    if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
      throw new Error(
        `Invalid category: ${data.category}. Must be one of: ${VALID_CATEGORIES.join(", ")}`
      );
    }

    // Validate cognitiveBiases
    if (!Array.isArray(data.cognitiveBiases)) {
      throw new Error("cognitiveBiases must be an array");
    }

    for (const bias of data.cognitiveBiases) {
      if (!bias.name || typeof bias.name !== "string") {
        throw new Error("Each cognitive bias must have a 'name' string");
      }
      if (!bias.description || typeof bias.description !== "string") {
        throw new Error("Each cognitive bias must have a 'description' string");
      }
    }

    // Validate missedAlternatives
    if (!Array.isArray(data.missedAlternatives)) {
      throw new Error("missedAlternatives must be an array");
    }

    for (const alt of data.missedAlternatives) {
      if (typeof alt !== "string") {
        throw new Error("Each missed alternative must be a string");
      }
    }

    // Validate insights
    if (!Array.isArray(data.insights)) {
      throw new Error("insights must be an array");
    }

    for (const insight of data.insights) {
      if (typeof insight !== "string") {
        throw new Error("Each insight must be a string");
      }
    }

    return {
      category: data.category,
      cognitiveBiases: data.cognitiveBiases,
      missedAlternatives: data.missedAlternatives,
      insights: data.insights,
    };
  }
}

