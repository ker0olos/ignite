import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Connected" / "Not connected" indicator on a provider card, or a spinner while loading. */
export function StatusPill({
  connected,
  loading,
}: {
  connected: boolean;
  loading: boolean;
}) {
  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium",
        connected ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}
