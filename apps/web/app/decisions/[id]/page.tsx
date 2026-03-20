"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DecisionDetailClient from "@/components/decision-detail-client";
import { StatusBadge } from "@/components/ui/status-badge";
import AppHeader from "@/components/app-header";

interface DecisionRun {
  id: string;
  status: string;
  categoryText: string | null;
  biasesText: string[] | null;
  createdAt: string;
}

interface Decision {
  id: string;
  situation: string;
  chosenDecision: string;
  personalReasoning: string;
  status: string;
  createdAt: string;
  latestRun: DecisionRun | null;
  runs: DecisionRun[];
}

export default function DecisionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const id = params.id as string;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchDecision = async () => {
      if (!accessToken) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/decisions/${id}`);

        if (response.status === 404) {
          router.push("/decisions");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch decision");
        }

        const data = await response.json();
        setDecision(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load decision");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDecision();
  }, [id, user, accessToken, authLoading, router]);

  // Status message helper
  const getStatusMessage = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Your decision is queued for AI analysis";
      case "PROCESSING":
        return "AI is currently analyzing your decision";
      case "DONE":
        return "Analysis complete - Review the insights below";
      case "FAILED":
        return "Analysis failed - Please try creating a new decision";
      default:
        return "";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-red-600 dark:text-red-400">{error || "Decision not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Decision Details
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Created {new Date(decision.createdAt).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={decision.status} />
          </div>

          {/* Status Message */}
          <div className="mt-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {getStatusMessage(decision.status)}
            </p>
          </div>
        </div>

        {/* Decision Content - Client Component for Real-time Updates */}
        <DecisionDetailClient
          initialDecision={{
            ...decision,
            createdAt: decision.createdAt,
          }}
        />
      </div>
    </div>
  );
}



