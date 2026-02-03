interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  // Color mapping for different categories
  const categoryColors: Record<string, string> = {
    CAREER: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
    FINANCIAL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
    RELATIONSHIPS: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400",
    HEALTH: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    EDUCATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    BUSINESS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
    LIFESTYLE: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
    ETHICAL: "bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400",
    CREATIVE: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/20 dark:text-fuchsia-400",
    TECHNICAL: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400",
    OTHER: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300",
  };

  const colorClass = categoryColors[category] || categoryColors.OTHER;

  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium ${colorClass}`}>
      {category}
    </span>
  );
}

