import {
  RetrievedDecision,
  RetrievedAttachmentChunk,
} from '../interfaces/vector-retrieval.types';

/**
 * Advisory Prompt Template
 *
 * Generates prompts for the advisory LLM that:
 * - Treats retrieved decisions as personal context, not facts
 * - Treats retrieved document chunks as source material, not facts
 * - Warns against assuming past decisions were correct
 * - Forbids inventing facts not present in documents
 * - Allows the model to say "I don't have enough context"
 * - Separates user question, retrieved context, and instructions
 */

export interface AdvisoryPromptInput {
  question: string;
  retrievedDecisions: RetrievedDecision[];
}

export interface DocumentAdvisoryPromptInput {
  question: string;
  retrievedChunks: RetrievedAttachmentChunk[];
  attachmentTitle: string;
}

/**
 * Build the system prompt for advisory requests
 * This sets the tone and constraints for the LLM
 */
export function buildAdvisorySystemPrompt(): string {
  return `You are a thoughtful decision advisor helping a user reflect on their past decisions.

Your role is to:
1. Provide perspective based on the user's past decision-making patterns
2. Help the user think critically about their current question
3. Point out patterns, potential blind spots, or considerations they might have missed

Important constraints:
- The user's past decisions are CONTEXT, not necessarily correct or optimal
- Do NOT assume past decisions were good decisions
- Do NOT simply recommend repeating past patterns
- If the past decisions seem problematic, gently point this out
- If you don't have enough relevant context, say so explicitly
- Be honest about the limitations of your advice

Your advice should be:
- Thoughtful and nuanced
- Based on observable patterns in the user's history
- Honest about uncertainty
- Respectful of the user's autonomy

Format your response as a conversational advisory message, not a formal report.`;
}

/**
 * Build the user prompt with question and retrieved context
 */
export function buildAdvisoryUserPrompt(input: AdvisoryPromptInput): string {
  const { question, retrievedDecisions } = input;

  // If no relevant decisions were retrieved
  if (retrievedDecisions.length === 0) {
    return `The user is asking for advice:

"${question}"

However, I don't have any relevant past decisions from this user that relate to this question.

Please provide thoughtful general advice, but be explicit that you don't have context about their past decision-making patterns in this area.`;
  }

  // Build context from retrieved decisions
  const contextSections = retrievedDecisions.map((decision, index) => {
    const reasoningSection = decision.personalReasoning
      ? `\nTheir reasoning: ${decision.personalReasoning}`
      : '';

    const similarityNote = `(Similarity: ${(decision.similarity * 100).toFixed(0)}%)`;

    return `Past Decision ${index + 1} ${similarityNote}:
Situation: ${decision.situation}
What they decided: ${decision.chosenDecision}${reasoningSection}
When: ${formatDate(decision.createdAt)}`;
  });

  return `The user is asking for advice:

"${question}"

Here are ${retrievedDecisions.length} relevant past decision(s) from this user:

${contextSections.join('\n\n---\n\n')}

---

Based on these past decisions, provide thoughtful advice for their current question. Remember:
- These past decisions are context, not necessarily examples to follow
- Look for patterns, both positive and concerning
- Be honest if you notice potential issues in their past decision-making
- If the past decisions don't provide enough relevant context, say so`;
}

/**
 * Format date for display in prompt
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

/**
 * Build complete prompt for advisory request
 * Returns both system and user prompts
 */
export function buildAdvisoryPrompt(input: AdvisoryPromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildAdvisorySystemPrompt(),
    userPrompt: buildAdvisoryUserPrompt(input),
  };
}

/**
 * Build the system prompt for document-grounded advisory requests
 * This sets strict constraints to prevent hallucination
 */
export function buildDocumentAdvisorySystemPrompt(): string {
  return `You are a document analysis assistant helping a user understand and make decisions based on a specific document.

Your role is to:
1. Answer the user's question based ONLY on the provided document excerpts
2. Help the user understand what the document says and what it means
3. Point out important details, potential concerns, or considerations from the document

CRITICAL CONSTRAINTS:
- You MUST base your answer ONLY on the provided document excerpts
- Do NOT invent, assume, or hallucinate facts not present in the document
- Do NOT use external knowledge about similar documents or situations
- If the document excerpts don't contain enough information to answer the question, say so explicitly
- If something is unclear or ambiguous in the document, point this out
- You may make reasonable inferences from what IS in the document, but clearly label them as inferences

Your advice should be:
- Grounded in the actual text of the document
- Honest about what is and isn't covered in the excerpts
- Clear about uncertainty or missing information
- Helpful in highlighting important details the user might have missed

Format your response as a conversational advisory message, not a formal report.`;
}

/**
 * Build the user prompt for document-grounded advisory requests
 */
export function buildDocumentAdvisoryUserPrompt(
  input: DocumentAdvisoryPromptInput,
): string {
  const { question, retrievedChunks, attachmentTitle } = input;

  // If no relevant chunks were retrieved
  if (retrievedChunks.length === 0) {
    return `The user is asking about the document "${attachmentTitle}":

"${question}"

However, I couldn't find any relevant sections in this document that relate to the question.

Please let the user know that:
1. The document doesn't appear to contain information relevant to their question
2. They might want to rephrase their question or ask about something else in the document
3. The document might not cover this topic`;
  }

  // Build context from retrieved chunks
  // Preserve chunk order for better context flow
  const contextSections = retrievedChunks.map((chunk, index) => {
    const similarityNote = `(Relevance: ${(chunk.similarity * 100).toFixed(0)}%)`;

    return `--- Excerpt ${index + 1} ${similarityNote} ---
${chunk.content}`;
  });

  return `The user is asking about the document "${attachmentTitle}":

"${question}"

Here are ${retrievedChunks.length} relevant excerpt(s) from the document:

${contextSections.join('\n\n')}

---

Based ONLY on these excerpts, provide advice for the user's question. Remember:
- Answer based ONLY on what's in the excerpts above
- Do NOT invent facts not present in the document
- If the excerpts don't fully answer the question, say so
- Point out important details, potential concerns, or considerations from the document
- If something is unclear or missing, explicitly state that`;
}

/**
 * Build complete prompt for document-grounded advisory request
 * Returns both system and user prompts
 */
export function buildDocumentAdvisoryPrompt(
  input: DocumentAdvisoryPromptInput,
): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildDocumentAdvisorySystemPrompt(),
    userPrompt: buildDocumentAdvisoryUserPrompt(input),
  };
}
