"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/app-header";
import AdviceClient from "@/components/advice-client";

export default function AdvicePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Ask for Advice
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Get AI-powered advice based on your past decisions or uploaded documents
          </p>
        </div>

        {/* Advice Client Component */}
        <AdviceClient userId={user.id} />
      </div>
    </div>
  );
}
