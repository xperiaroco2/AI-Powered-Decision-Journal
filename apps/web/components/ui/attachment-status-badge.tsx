/**
 * AttachmentStatusBadge Component
 * 
 * Displays a colored badge for attachment processing status.
 */

interface AttachmentStatusBadgeProps {
  status: string;
}

export function AttachmentStatusBadge({ status }: AttachmentStatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "READY":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "FAILED":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "READY":
        return "✓";
      case "PROCESSING":
        return "⏳";
      case "PENDING":
        return "⏸";
      case "FAILED":
        return "✗";
      default:
        return "•";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles()}`}
    >
      <span>{getStatusIcon()}</span>
      <span>{status}</span>
    </span>
  );
}

