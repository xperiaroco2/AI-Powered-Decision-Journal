"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface SignOutButtonProps {
  variant?: "default" | "compact";
}

export default function SignOutButton({ variant = "default" }: SignOutButtonProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const baseClasses = "cursor-pointer rounded-md text-sm font-semibold";

  const variantClasses = {
    default: "flex-1 border border-zinc-300 px-4 py-2 text-center text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700",
    compact: "border border-zinc-300 px-3 py-1.5 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      Sign Out
    </button>
  );
}
