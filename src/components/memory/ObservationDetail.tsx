import type { MemoryObservation } from "../../../shared/memory";

/** What an observation's row opens to: its summary, facts and files. */
export function ObservationDetail({
  observation: { subtitle, facts, files },
}: {
  observation: MemoryObservation;
}) {
  return (
    <div className="space-y-2 pb-1 pl-7 text-xs text-muted-foreground">
      {subtitle && <p>{subtitle}</p>}
      {facts.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4">
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <span
              key={i}
              className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
