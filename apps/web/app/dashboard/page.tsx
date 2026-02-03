import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";
import AppHeader from "@/components/app-header";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
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

