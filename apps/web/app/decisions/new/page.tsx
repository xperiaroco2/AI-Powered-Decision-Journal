"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import { useAuth } from "@/hooks/useAuth";
import {
  validateSituation,
  validateDecision,
  validateReasoning,
  countWords,
} from "@/lib/validation";

export default function NewDecisionPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [situation, setSituation] = useState("");
  const [chosenDecision, setChosenDecision] = useState("");
  const [personalReasoning, setPersonalReasoning] = useState("");
  const [error, setError] = useState("");
  const [situationError, setSituationError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [warnings, setWarnings] = useState<{
    situation?: string;
    decision?: string;
    reasoning?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Real-time validation for warnings (non-blocking)
  const handleSituationChange = (value: string) => {
    setSituation(value);
    setSituationError(""); // Clear error on change
    const result = validateSituation(value);
    setWarnings((prev) => ({
      ...prev,
      situation: result.warning,
    }));
  };

  const handleDecisionChange = (value: string) => {
    setChosenDecision(value);
    setDecisionError(""); // Clear error on change
    const result = validateDecision(value);
    setWarnings((prev) => ({
      ...prev,
      decision: result.warning,
    }));
  };

  const handleReasoningChange = (value: string) => {
    setPersonalReasoning(value);
    const result = validateReasoning(value);
    setWarnings((prev) => ({
      ...prev,
      reasoning: result.warning,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSituationError("");
    setDecisionError("");

    // Frontend validation using word count (matches backend)
    const situationResult = validateSituation(situation);
    const decisionResult = validateDecision(chosenDecision);
    const reasoningResult = personalReasoning
      ? validateReasoning(personalReasoning)
      : { isValid: true };

    // Check for validation errors
    if (!situationResult.isValid) {
      setSituationError(situationResult.error || "Situation is required");
      return;
    }

    if (!decisionResult.isValid) {
      setDecisionError(decisionResult.error || "Decision is required");
      return;
    }

    if (!reasoningResult.isValid) {
      setError(reasoningResult.error || "Invalid reasoning");
      return;
    }

    setIsLoading(true);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Add Authorization header if access token is available
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const response = await fetch("/api/decisions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          situation,
          chosenDecision,
          personalReasoning: personalReasoning || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create decision");
        return;
      }

      // Redirect to the decision detail page
      router.push(`/decisions/${data.id}`);
    } catch (_err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            New Decision
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Document your decision for AI-powered analysis
          </p>
        </div>

        {/* Form */}
        <div className="rounded-lg bg-white p-8 shadow dark:bg-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Situation */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="situation"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Situation <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {countWords(situation)} words (min. 10)
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Describe the context and circumstances surrounding your decision
              </p>
              <textarea
                id="situation"
                name="situation"
                rows={5}
                value={situation}
                onChange={(e) => handleSituationChange(e.target.value)}
                className={`mt-2 block w-full rounded-md border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500 ${
                  situationError
                    ? "border-red-500 dark:border-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                placeholder="e.g., I've been offered a new job with higher pay but it requires relocating to a different city..."
              />
              {situationError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {situationError}
                </p>
              )}
              {!situationError && warnings.situation && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ {warnings.situation}
                </p>
              )}
            </div>

            {/* Chosen Decision */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="chosenDecision"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Your Decision <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {countWords(chosenDecision)} words (min. 5)
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                What did you decide to do?
              </p>
              <textarea
                id="chosenDecision"
                name="chosenDecision"
                rows={3}
                value={chosenDecision}
                onChange={(e) => handleDecisionChange(e.target.value)}
                className={`mt-2 block w-full rounded-md border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500 ${
                  decisionError
                    ? "border-red-500 dark:border-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                placeholder="e.g., I decided to accept the job offer and relocate"
              />
              {decisionError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {decisionError}
                </p>
              )}
              {!decisionError && warnings.decision && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ {warnings.decision}
                </p>
              )}
            </div>

            {/* Personal Reasoning (Optional) */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="personalReasoning"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Your Reasoning <span className="text-zinc-400">(Optional)</span>
                </label>
                {personalReasoning && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {countWords(personalReasoning)} words
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Why did you make this decision? What factors influenced you?
              </p>
              <textarea
                id="personalReasoning"
                name="personalReasoning"
                rows={4}
                value={personalReasoning}
                onChange={(e) => handleReasoningChange(e.target.value)}
                className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="e.g., The salary increase will help me pay off student loans faster, and I'm excited about the career growth opportunities..."
              />
              {warnings.reasoning && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ {warnings.reasoning}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isLoading ? "Creating..." : "Create Decision"}
              </button>
              <Link
                href="/decisions"
                className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

