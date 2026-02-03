"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

export default function NewDecisionPage() {
  const router = useRouter();
  const [situation, setSituation] = useState("");
  const [chosenDecision, setChosenDecision] = useState("");
  const [personalReasoning, setPersonalReasoning] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Frontend validation
    if (situation.trim().length < 10) {
      setError("Situation must be at least 10 characters");
      return;
    }

    if (chosenDecision.trim().length < 5) {
      setError("Decision must be at least 5 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <Link
              href="/decisions"
              className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ← Back to decisions
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
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
              <label
                htmlFor="situation"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Situation <span className="text-red-500">*</span>
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Describe the context and circumstances surrounding your decision
              </p>
              <textarea
                id="situation"
                name="situation"
                required
                minLength={10}
                rows={5}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="e.g., I've been offered a new job with higher pay but it requires relocating to a different city..."
              />
            </div>

            {/* Chosen Decision */}
            <div>
              <label
                htmlFor="chosenDecision"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Your Decision <span className="text-red-500">*</span>
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                What did you decide to do?
              </p>
              <textarea
                id="chosenDecision"
                name="chosenDecision"
                required
                minLength={5}
                rows={3}
                value={chosenDecision}
                onChange={(e) => setChosenDecision(e.target.value)}
                className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="e.g., I decided to accept the job offer and relocate"
              />
            </div>

            {/* Personal Reasoning (Optional) */}
            <div>
              <label
                htmlFor="personalReasoning"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Your Reasoning <span className="text-zinc-400">(Optional)</span>
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Why did you make this decision? What factors influenced you?
              </p>
              <textarea
                id="personalReasoning"
                name="personalReasoning"
                rows={4}
                value={personalReasoning}
                onChange={(e) => setPersonalReasoning(e.target.value)}
                className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="e.g., The salary increase will help me pay off student loans faster, and I'm excited about the career growth opportunities..."
              />
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

