import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoginState } from "@/hooks/useProviders";

/** A running sign-in: what's happening, and a way out. */
export function LoginPanel({
  login,
  onCancel,
}: {
  login: LoginState;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        {login.progress ??
          (login.method === "api_key"
            ? "Saving your key…"
            : "Waiting for you to sign in…")}
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
