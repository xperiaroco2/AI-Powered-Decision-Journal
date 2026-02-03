import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AppHeader from "@/components/app-header";
import DecisionsFilterBar from "@/components/decisions-filter-bar";
import { Prisma } from "@prisma/client";

type SearchParams = Promise<{
  status?: string;
  category?: string;
  bias?: string;
  sort?: string;
}>;

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;

  // Build where clause based on filters
  const where: Prisma.DecisionWhereInput = {
    userId: session.user.id,
  };

  // Filter by status (based on latestRun status)
  if (params.status && params.status !== "ALL") {
    if (params.status === "PENDING") {
      where.latestRun = { status: "PENDING" };
    } else if (params.status === "PROCESSING") {
      where.latestRun = { status: "PROCESSING" };
    } else if (params.status === "COMPLETED") {
      where.latestRun = { status: "COMPLETED" };
    } else if (params.status === "FAILED") {
      where.latestRun = { status: "FAILED" };
    }
  }

  // Filter by category (based on latestRun categoryText)
  if (params.category && params.category !== "ALL") {
    where.latestRun = {
      ...where.latestRun,
      categoryText: params.category,
    };
  }

  // Filter by bias (based on latestRun biasesText array)
  if (params.bias && params.bias !== "ALL") {
    where.latestRun = {
      ...where.latestRun,
      biasesText: {
        has: params.bias,
      },
    };
  }

  // Build orderBy clause based on sort param
  let orderBy: Prisma.DecisionOrderByWithRelationInput[] = [];

  switch (params.sort) {
    case "oldest":
      orderBy = [{ createdAt: "asc" }];
      break;
    case "needs-attention":
      // FAILED first, then PENDING/PROCESSING, then COMPLETED
      // We'll use a raw query for this complex sort
      orderBy = [{ createdAt: "desc" }]; // Fallback
      break;
    case "most-biases":
      // Sort by bias count (descending)
      // We'll handle this with a raw query
      orderBy = [{ createdAt: "desc" }]; // Fallback
      break;
    case "newest":
    default:
      orderBy = [{ createdAt: "desc" }];
      break;
  }

  // Fetch decisions with latestRun
  let decisions = await prisma.decision.findMany({
    where,
    orderBy,
    include: {
      latestRun: {
        select: {
          id: true,
          status: true,
          categoryText: true,
          biasesText: true,
        },
      },
    },
  });

  // Handle complex sorting in-memory for demo simplicity
  if (params.sort === "needs-attention") {
    decisions = decisions.sort((a, b) => {
      const statusOrder = { FAILED: 0, PENDING: 1, PROCESSING: 2, COMPLETED: 3 };
      const aStatus = a.latestRun?.status || "PENDING";
      const bStatus = b.latestRun?.status || "PENDING";
      return (
        (statusOrder[aStatus as keyof typeof statusOrder] || 4) -
        (statusOrder[bStatus as keyof typeof statusOrder] || 4)
      );
    });
  } else if (params.sort === "most-biases") {
    decisions = decisions.sort((a, b) => {
      const aBiases = a.latestRun?.biasesText?.length || 0;
      const bBiases = b.latestRun?.biasesText?.length || 0;
      return bBiases - aBiases; // Descending
    });
  }

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

        {/* Filter Bar */}
        <DecisionsFilterBar
          currentStatus={params.status || "ALL"}
          currentCategory={params.category || "ALL"}
          currentBias={params.bias || "ALL"}
          currentSort={params.sort || "newest"}
        />

        {/* Decisions List */}
        {decisions.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow dark:bg-zinc-800">
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              {params.status || params.category || params.bias
                ? "No decisions match your filters."
                : "No decisions yet. Create your first decision to get started!"}
            </p>
            {!params.status && !params.category && !params.bias && (
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
            {decisions.map((decision) => (
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
                    <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                      <span>
                        {new Date(decision.createdAt).toLocaleDateString()}
                      </span>
                      {decision.latestRun?.categoryText && (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-700">
                          {decision.latestRun.categoryText}
                        </span>
                      )}
                      {decision.latestRun?.biasesText &&
                        decision.latestRun.biasesText.length > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                            {decision.latestRun.biasesText.length} bias
                            {decision.latestRun.biasesText.length > 1 ? "es" : ""}
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <RunStatusBadge
                      status={decision.latestRun?.status || "PENDING"}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Run status badge component
function RunStatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    PROCESSING:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    COMPLETED:
      "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.PENDING
      }`}
    >
      {status}
    </span>
  );
}

