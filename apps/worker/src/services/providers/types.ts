import { Category } from "@prisma/client";

// Valid category values from Prisma enum
export const VALID_CATEGORIES: Category[] = [
  "CAREER",
  "FINANCIAL",
  "RELATIONSHIPS",
  "HEALTH",
  "EDUCATION",
  "BUSINESS",
  "LIFESTYLE",
  "ETHICAL",
  "CREATIVE",
  "TECHNICAL",
  "OTHER",
];

// Type definitions for analysis response
export interface CognitiveBias {
  name: string;
  description: string;
}

export interface AnalysisResult {
  category: Category;
  cognitiveBiases: CognitiveBias[];
  missedAlternatives: string[];
  insights: string[];
  rawAiResponse: string;
}

export interface DecisionInput {
  situation: string;
  chosenDecision: string;
  personalReasoning: string | null;
}

// Provider interface
export interface AIProvider {
  analyze(input: DecisionInput): Promise<AnalysisResult>;
}

