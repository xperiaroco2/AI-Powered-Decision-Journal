"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/theme-toggle";
import SignOutButton from "@/components/sign-out-button";

export default function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Home Link */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-zinc-900 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            <span>📓</span>
            <span className="hidden sm:inline">Decision Journal</span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            <Link
              href="/decisions"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Decisions
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/advice"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Ask for Advice
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {user?.email && (
              <div className="flex items-center gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
                <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
                  {user.email}
                </span>
                <SignOutButton variant="compact" />
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

