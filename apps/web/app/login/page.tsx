"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Invalid email or password");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md dark:bg-zinc-800">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full cursor-pointer justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Don&apos;t have an account?{" "}
            </span>
            <Link
              href="/register"
              className="cursor-pointer font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

