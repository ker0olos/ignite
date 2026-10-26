import type { Reflection } from "../../../shared/reflector";

/** When a point applies and the user's words that taught it, under its tags; nothing when it has neither. */
export function ReflectionBasis({
  reflection,
}: {
  reflection: Pick<Reflection, "when" | "evidence">;
}) {
  const { when, evidence } = reflection;
  if (!when && !evidence) return null;
  return (
    <span className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {when && <span>When {when}</span>}
      {evidence && <span className="italic">“{evidence}”</span>}
    </span>
  );
}
