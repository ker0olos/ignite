import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdateState } from "@/lib/about";

/** The bottom-right notification while an update installs, then until it's restarted into. */
export function UpdateToast({
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
      className="fixed right-4 bottom-4 z-50 flex w-80 items-start gap-2.5 rounded-lg border bg-popover p-3 text-[13px] text-popover-foreground shadow-lg"
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
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(update)}
            >
              Later
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await onRestart().catch(() => {});
                setPending(false);
              }}
            >
              Restart to update
            </Button>
          </div>
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
