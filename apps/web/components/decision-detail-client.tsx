"use client";

import { useState, useEffect } from "react";
import { useDecisionUpdates } from "@/hooks/useDecisionUpdates";
import { useRouter } from "next/navigation";
import { CategoryBadge } from "@/components/ui/category-badge";
import DecisionAttachments from "@/components/decision-attachments";

interface CognitiveBias {
  name: string;
  description: string;
}

interface AnalysisRun {
  id: string;
  status: string;
  provider: string;
  resultJson: Record<string, unknown>;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

interface Decision {
  id: string;
  situation: string;
  chosenDecision: string;
  personalReasoning: string | null;
  status: string;
  createdAt: Date;
  latestRunId: string | null;
  latestRun: AnalysisRun | null;
  runs: AnalysisRun[];
}

interface DecisionDetailClientProps {
  initialDecision: Decision;
}

export default function DecisionDetailClient({
  initialDecision,
}: DecisionDetailClientProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [isRerunning, setIsRerunning] = useState(false);
  const { status: realtimeStatus } = useDecisionUpdates(decision.id);
  const router = useRouter();

  // Sync state when initialDecision changes (after router.refresh())
  useEffect(() => {
    setDecision(initialDecision);
  }, [initialDecision]);

  // Update decision status when real-time update arrives
  useEffect(() => {
    if (realtimeStatus) {
      console.log(`🔄 Updating status to: ${realtimeStatus}`);
      // Map COMPLETED to DONE for UI compatibility
      const mappedStatus = realtimeStatus === "COMPLETED" ? "DONE" : realtimeStatus;
      setDecision((prev) => ({ ...prev, status: mappedStatus }));

      // Refresh the page data when status changes to DONE/COMPLETED
      if (realtimeStatus === "COMPLETED" || realtimeStatus === "DONE") {
        router.refresh();
      }
    }
  }, [realtimeStatus, router]);

  // Get analysis data from latestRun
  const analysisData = decision.latestRun?.resultJson || null;

  // Handle re-run analysis
  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      const response = await fetch(`/api/decisions/${decision.id}/rerun`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || "Failed to start re-analysis");
        return;
      }

      // Refresh to get updated status
      router.refresh();
    } catch (error) {
      console.error("Error starting re-analysis:", error);
      alert("Failed to start re-analysis");
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <>
      {/* Decision Content */}
      <div className="space-y-6">
        {/* Your Decision */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Your Decision
          </h2>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            {decision.chosenDecision}
          </p>
        </div>

        {/* Situation */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Situation
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {decision.situation}
          </p>
        </div>

        {/* Personal Reasoning */}
        {decision.personalReasoning && (
          <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Your Reasoning
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {decision.personalReasoning}
            </p>
          </div>
        )}

        {/* Analysis Section */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            AI Analysis
          </h2>

          {/* PENDING State */}
          {decision.status === "PENDING" && (
            <div className="mt-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                ⏳ Analysis pending - Your decision is queued for AI analysis
              </p>
            </div>
          )}

          {/* PROCESSING State */}
          {decision.status === "PROCESSING" && (
            <div className="mt-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                🔄 Analysis in progress - AI is analyzing your decision
              </p>
            </div>
          )}

          {/* FAILED State */}
          {decision.status === "FAILED" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  ❌ Analysis failed
                </p>
                {decision.latestRun?.error && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-500">
                    {decision.latestRun.error}
                  </p>
                )}
              </div>
              {/* Retry Button */}
              <button
                onClick={handleRerun}
                disabled={isRerunning}
                className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700 dark:hover:bg-red-600"
              >
                {isRerunning ? "Starting retry..." : "🔄 Retry Analysis"}
              </button>
            </div>
          )}

          {/* DONE State - Full Analysis Display */}
          {decision.status === "DONE" && decision.latestRun?.resultJson && (
            <div className="mt-4 space-y-6">
              {/* Re-run Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleRerun}
                  disabled={isRerunning}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {isRerunning ? "Starting re-analysis..." : "🔄 Re-analyze"}
                </button>
              </div>
              {/* Category */}
              <div>
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category
                </h3>
                <div className="mt-2">
                  <CategoryBadge category={analysisData.category} />
                </div>
              </div>

              {/* Insights */}
              {analysisData.insights && analysisData.insights.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Key Insights
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {analysisData.insights.map((insight: string, index: number) => (
                      <li
                        key={index}
                        className="flex items-start text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="mr-2 mt-0.5 text-green-600 dark:text-green-400">
                          •
                        </span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cognitive Biases */}
              {analysisData.cognitiveBiases && analysisData.cognitiveBiases.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Cognitive Biases Detected
                  </h3>
                  <div className="mt-3 space-y-3">
                    {analysisData.cognitiveBiases.map((bias: CognitiveBias, index: number) => (
                      <div
                        key={index}
                        className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                      >
                        <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                          {bias.name}
                        </h4>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {bias.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed Alternatives */}
              {analysisData.missedAlternatives && analysisData.missedAlternatives.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Alternatives to Consider
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {analysisData.missedAlternatives.map((alternative: string, index: number) => (
                      <li
                        key={index}
                        className="flex items-start text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="mr-2 mt-0.5 text-blue-600 dark:text-blue-400">
                          •
                        </span>
                        <span>{alternative}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attachments Section */}
        <DecisionAttachments decisionId={decision.id} />

        {/* Previous Runs Section */}
        {decision.runs && decision.runs.length > 1 && (
          <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Previous Analysis Runs
            </h2>
            <div className="mt-4 space-y-3">
              {decision.runs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((run) => {
                  const isLatest = run.id === decision.latestRunId;
                  const statusColor =
                    run.status === "COMPLETED" ? "text-green-600 dark:text-green-400" :
                    run.status === "FAILED" ? "text-red-600 dark:text-red-400" :
                    run.status === "PROCESSING" ? "text-blue-600 dark:text-blue-400" :
                    "text-yellow-600 dark:text-yellow-400";

                  return (
                    <div
                      key={run.id}
                      className={`rounded-md border p-3 ${
                        isLatest
                          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                          : "border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${statusColor}`}>
                            {run.status}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                          {isLatest && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-blue-700">
                              Latest
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {run.provider}
                        </span>
                      </div>
                      {run.error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                          Error: {run.error}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

