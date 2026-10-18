import { CircleAlert } from "lucide-react";

/** Why the conversation couldn't start or run, on its own line above the composer's controls. */
export function ComposerError({ error }: { error: string }) {
  return (
    <p
      role="alert"
      title={error}
      className="flex items-start gap-1.5 px-0.5 text-xs text-destructive select-text"
    >
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      <span className="line-clamp-2 min-w-0 break-words">{error}</span>
    </p>
  );
}
