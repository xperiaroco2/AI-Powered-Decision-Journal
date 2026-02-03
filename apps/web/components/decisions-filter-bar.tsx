"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DecisionsFilterBar({
  currentStatus,
  currentCategory,
  currentBias,
  currentSort,
}: {
  currentStatus: string;
  currentCategory: string;
  currentBias: string;
  currentSort: string;
}) {
  const router = useRouter();

  const categories = [
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

  const commonBiases = [
    "Confirmation Bias",
    "Anchoring Bias",
    "Availability Bias",
    "Sunk Cost Fallacy",
    "Overconfidence Bias",
    "Status Quo Bias",
    "Recency Bias",
    "Hindsight Bias",
  ];

  const updateFilter = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value === "ALL" || (key === "sort" && value === "newest")) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    router.push(url.pathname + url.search);
  };

  return (
    <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-zinc-800">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Status Filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            value={currentStatus}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Category
          </label>
          <select
            value={currentCategory}
            onChange={(e) => updateFilter("category", e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Bias Filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Bias
          </label>
          <select
            value={currentBias}
            onChange={(e) => updateFilter("bias", e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
          >
            <option value="ALL">All Biases</option>
            {commonBiases.map((bias) => (
              <option key={bias} value={bias}>
                {bias}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Sort By
          </label>
          <select
            value={currentSort}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="needs-attention">Needs Attention</option>
            <option value="most-biases">Most Biases</option>
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      {(currentStatus !== "ALL" ||
        currentCategory !== "ALL" ||
        currentBias !== "ALL" ||
        currentSort !== "newest") && (
        <div className="mt-3 flex justify-end">
          <Link
            href="/decisions"
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Clear all filters
          </Link>
        </div>
      )}
    </div>
  );
}

