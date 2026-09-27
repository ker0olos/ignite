import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder turns while the session opens, laid out like Conversation. */
export function ConversationSkeleton() {
  return (
    <div
      data-tauri-drag-region
      className="mx-auto max-w-3xl space-y-6 px-4 py-6"
    >
      <Skeleton className="ml-auto h-9 w-2/5 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <Skeleton className="ml-auto h-9 w-1/3 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
