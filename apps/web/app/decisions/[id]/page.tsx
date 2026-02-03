import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DecisionDetailClient from "@/components/decision-detail-client";
import { StatusBadge } from "@/components/ui/status-badge";
import ThemeToggle from "@/components/theme-toggle";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  // Fetch decision server-side with runs
  const decision = await prisma.decision.findUnique({
    where: {
      id,
    },
    include: {
      latestRun: true,
      runs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  // Check if decision exists and belongs to user
  if (!decision || decision.userId !== session.user.id) {
    notFound();
  }

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
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
          <div className="mt-4 flex items-start justify-between">
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



