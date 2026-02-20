"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiGet } from "@/lib/api-client";
import DecisionsFilterBar from "@/components/decisions-filter-bar";

interface DecisionRun {
  id: string;
  status: string;
  categoryText: string | null;
  biasesText: string[] | null;
}

interface Decision {
  id: string;
  situation: string;
  chosenDecision: string;
  createdAt: string;
  latestRun: DecisionRun | null;
}

export default function DecisionsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Get filter params
  const status = searchParams.get("status") || "ALL";
  const category = searchParams.get("category") || "ALL";
  const bias = searchParams.get("bias") || "ALL";
  const sort = searchParams.get("sort") || "newest";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchDecisions = async () => {
      try {
        setIsLoading(true);
        const response = await apiGet("/decisions", accessToken);
        
        if (!response.ok) {
          throw new Error("Failed to fetch decisions");
        }

        const data = await response.json();
        setDecisions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load decisions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDecisions();
  }, [user, accessToken, authLoading, router]);

  // Filter decisions
  const filteredDecisions = decisions.filter((decision) => {
    // Status filter
    if (status !== "ALL") {
      const runStatus = decision.latestRun?.status || "PENDING";
      if (runStatus !== status) return false;
    }

    // Category filter
    if (category !== "ALL") {
      const runCategory = decision.latestRun?.categoryText || "";
      if (runCategory !== category) return false;
    }

    // Bias filter
    if (bias !== "ALL") {
      const biases = decision.latestRun?.biasesText || [];
      if (!biases.includes(bias)) return false;
    }

    return true;
  });

  // Sort decisions
  const sortedDecisions = [...filteredDecisions].sort((a, b) => {
    if (sort === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sort === "needs-attention") {
      const statusOrder: Record<string, number> = { FAILED: 0, PENDING: 1, PROCESSING: 2, COMPLETED: 3 };
      const aStatus = a.latestRun?.status || "PENDING";
      const bStatus = b.latestRun?.status || "PENDING";
      return (statusOrder[aStatus] || 4) - (statusOrder[bStatus] || 4);
    } else if (sort === "most-biases") {
      const aBiases = a.latestRun?.biasesText?.length || 0;
      const bBiases = b.latestRun?.biasesText?.length || 0;
      return bBiases - aBiases;
    } else {
      // newest (default)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <>
      {/* Filter Bar */}
      <DecisionsFilterBar
        currentStatus={status}
        currentCategory={category}
        currentBias={bias}
        currentSort={sort}
      />

      {/* Decisions List */}
      {sortedDecisions.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow dark:bg-zinc-800">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {status !== "ALL" || category !== "ALL" || bias !== "ALL"
              ? "No decisions match your filters."
              : "No decisions yet. Create your first decision to get started!"}
          </p>
          {status === "ALL" && category === "ALL" && bias === "ALL" && (
            <Link
              href="/decisions/new"
              className="mt-4 inline-block cursor-pointer rounded-md bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Create Decision
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDecisions.map((decision) => (
            <Link
              key={decision.id}
              href={`/decisions/${decision.id}`}
              className="block cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {decision.chosenDecision}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {decision.situation}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {decision.latestRun?.status && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          decision.latestRun.status === "COMPLETED"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : decision.latestRun.status === "FAILED"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                              : decision.latestRun.status === "PROCESSING"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                        }`}
                      >
                        {decision.latestRun.status}
                      </span>
                    )}
                    {decision.latestRun?.categoryText && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300">
                        {decision.latestRun.categoryText}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(decision.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

