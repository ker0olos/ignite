import { groupConnection } from "@/lib/providerGroups";
import { cn } from "@/lib/utils";

/** Connection status dot and label for a provider group. */
export function ProviderState({
  how,
}: {
  how: ReturnType<typeof groupConnection> | undefined;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          how ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      {how === undefined
        ? "Checking"
        : how === "subscription"
          ? "Subscription"
          : how === "api_key"
            ? "API key"
            : "Not connected"}
    </span>
  );
}
