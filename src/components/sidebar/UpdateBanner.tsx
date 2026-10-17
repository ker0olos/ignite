import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Says a built update waits for a restart; dismissing hides it until the next launch. */
export function UpdateBanner({
  ready,
  onRestart,
}: {
  ready: boolean;
  onRestart: () => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  if (!ready || dismissed) return null;
  return (
    <div className="mx-2 mb-2 flex items-start gap-2 rounded-lg border bg-muted/50 p-2.5 text-[13px]">
      <RefreshCw className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Update ready</p>
        <p className="text-xs text-muted-foreground">
          Restart to run the new version.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await onRestart().catch(() => setPending(false));
          }}
        >
          Restart
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X />
      </Button>
    </div>
  );
}
