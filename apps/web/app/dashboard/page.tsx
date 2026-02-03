import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";
import ThemeToggle from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
            Dashboard
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Insights from your decision analysis history
          </p>
        </div>

        {/* Dashboard Content */}
        <DashboardClient />
      </div>
    </div>
  );
}

