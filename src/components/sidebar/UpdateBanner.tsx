import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdateState } from "@/lib/about";

/** Says an update installs, then waits for a restart; dismissing hides it until it moves on. */
export function UpdateBanner({
  update,
  warning,
  onRestart,
}: {
  update: UpdateState;
  warning: string | null;
  onRestart: () => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState<UpdateState | null>(null);
  const [pending, setPending] = useState(false);
  if (update !== "installing" && update !== "ready") return null;
  if (dismissed === update) return null;
  const ready = update === "ready";
  return (
    <div
      role="status"
      className="mx-2 mb-2 flex items-start gap-2 rounded-lg border bg-muted/50 p-2.5 text-[13px]"
    >
      {ready ? (
        <RefreshCw className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {ready ? "Update ready" : "Installing update…"}
        </p>
        <p className="text-xs text-muted-foreground">
          {ready
            ? "Restart to run the new version."
            : "You can keep working while it installs."}
        </p>
        {ready && warning && (
          <p className="mt-1 text-xs text-muted-foreground">{warning}</p>
        )}
        {ready && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onRestart().catch(() => {});
              setPending(false);
            }}
          >
            Restart
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        onClick={() => setDismissed(update)}
      >
        <X />
      </Button>
    </div>
  );
}
