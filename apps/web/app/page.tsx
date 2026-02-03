import Link from "next/link";
import { auth } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";
import ThemeToggle from "@/components/theme-toggle";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <main className="w-full max-w-2xl space-y-8 px-4 py-16">
        {/* Theme Toggle - Top Right */}
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI-Powered Decision Journal
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Make better decisions with AI-powered insights
          </p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-md dark:bg-zinc-800">
          {session?.user ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-400">
                  ✓ You are signed in as {session.user.email}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/decisions"
                    className="flex-1 cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    My Decisions
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex-1 cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
                  >
                    Dashboard
                  </Link>
                </div>
                <SignOutButton />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-zinc-600 dark:text-zinc-400">
                Sign in to start journaling your decisions
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="flex-1 cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex-1 cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
