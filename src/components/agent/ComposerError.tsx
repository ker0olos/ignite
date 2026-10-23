import { CircleAlert, X } from "lucide-react";

/** Why the conversation couldn't start or run, on its own line above the composer's controls, until dismissed. */
export function ComposerError({
  session: { error, dismissError },
}: {
  session: { error: string | null; dismissError: () => void };
}) {
  if (!error) return null;
  return (
    <p
      role="alert"
      title={error}
      className="flex items-start gap-1.5 px-0.5 text-xs text-destructive select-text"
    >
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      <span className="line-clamp-2 min-w-0 flex-1 break-words">{error}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissError}
        className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
      >
        <X className="mt-px size-3.5" />
      </button>
    </p>
  );
}
