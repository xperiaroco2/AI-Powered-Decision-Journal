"use client";

import { signOut } from "next-auth/react";

interface SignOutButtonProps {
  variant?: "default" | "compact";
}

export default function SignOutButton({ variant = "default" }: SignOutButtonProps) {
  const baseClasses = "cursor-pointer rounded-md text-sm font-semibold";

  const variantClasses = {
    default: "flex-1 border border-zinc-300 px-4 py-2 text-center text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700",
    compact: "border border-zinc-300 px-3 py-1.5 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
  };

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      Sign Out
    </button>
  );
}

