import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Warns that MCP servers in use wait for sign-in, before the agent needs them.
 * Dismissing hides it until a different set of servers needs sign-in.
 */
export function SignInBanner({
  names,
  onSignIn,
  onOpenSettings,
}: {
  names: string[];
  onSignIn: (name: string) => Promise<void>;
  onOpenSettings: () => void;
}) {
  const key = names.join("\n");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (names.length === 0 || dismissed === key) return null;

  const one = names.length === 1 ? names[0] : null;
  return (
    <div className="mx-2 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[13px]">
      <KeyRound className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {one
            ? `${one} needs sign-in`
            : `${names.length} MCP servers need sign-in`}
        </p>
        <p className="text-xs text-muted-foreground">
          {one
            ? "The agent can't use it until you sign in."
            : "The agent can't use them until you sign in."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={async () => {
            if (!one) return onOpenSettings();
            setPending(true);
            await onSignIn(one);
            setPending(false);
          }}
        >
          {one ? "Sign in" : "Review in Settings"}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        onClick={() => setDismissed(key)}
      >
        <X />
      </Button>
    </div>
  );
}
