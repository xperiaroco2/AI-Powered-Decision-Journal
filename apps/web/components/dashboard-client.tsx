"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface CategoryData {
  name: string;
  count: number;
}

interface BiasData {
  name: string;
  count: number;
}

interface DashboardData {
  totalDecisions: number;
  categories: CategoryData[];
  biases: BiasData[];
}

export default function DashboardClient() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;

    async function fetchDashboardData() {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [accessToken, authLoading]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 dark:bg-red-900/20">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-400">
          Error Loading Dashboard
        </h3>
        <p className="mt-2 text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!data || data.totalDecisions === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow dark:bg-zinc-800">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📊</div>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            No Analysis Data Yet
          </h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Create your first decision and wait for the analysis to complete to see
            insights here.
          </p>
          <Link
            href="/decisions/new"
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Decision
          </Link>
        </div>
      </div>
    );
  }

  // Calculate max count for scaling bars
  const maxCategoryCount = Math.max(...data.categories.map((c) => c.count), 1);
  const maxBiasCount = Math.max(...data.biases.map((b) => b.count), 1);

  // Format category name for display
  const formatCategoryName = (name: string) => {
    return name
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Total Analyzed Decisions
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {data.totalDecisions}
            </p>
          </div>
          <div className="text-5xl">🎯</div>
        </div>
      </div>

      {/* Categories Visualization */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Decision Categories
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Distribution of your decisions by category
        </p>

        <div className="mt-6 space-y-4">
          {data.categories.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No category data available
            </p>
          ) : (
            data.categories.map((category) => {
              const percentage = (category.count / maxCategoryCount) * 100;
              return (
                <div key={category.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {formatCategoryName(category.name)}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {category.count} {category.count === 1 ? "decision" : "decisions"}
                    </span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-700">
                    <div
                      className="h-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Biases Visualization */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Common Cognitive Biases
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Top 10 biases identified across your decisions
        </p>

        <div className="mt-6 space-y-4">
          {data.biases.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No bias data available
            </p>
          ) : (
            data.biases.map((bias, index) => {
              const percentage = (bias.count / maxBiasCount) * 100;
              return (
                <div key={bias.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {bias.name}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {bias.count} {bias.count === 1 ? "occurrence" : "occurrences"}
                    </span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-700">
                    <div
                      className="h-full bg-orange-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Note */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          <strong>Note:</strong> Dashboard shows data from the latest completed analysis
          for each decision. Failed or pending analyses are not included.
        </p>
      </div>
    </div>
  );
}

