"use client";

import { Suspense } from "react";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import DecisionsListClient from "@/components/decisions-list-client";

export default function DecisionsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              My Decisions
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Track and analyze your important decisions
            </p>
          </div>
          <Link
            href="/decisions/new"
            className="cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New Decision
          </Link>
        </div>

        {/* Decisions List */}
        <Suspense fallback={<div className="text-center text-zinc-600 dark:text-zinc-400">Loading...</div>}>
          <DecisionsListClient />
        </Suspense>
      </div>
    </div>
  );
}
