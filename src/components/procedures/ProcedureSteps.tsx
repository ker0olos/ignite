import { Folder } from "lucide-react";
import type { Procedure } from "../../../shared/procedures";
import { lessonScope } from "@/lib/lessons";

/** A procedure's hint: the folder it applies in, then its steps in order. */
export function ProcedureSteps({
  procedure,
}: {
  procedure: Pick<Procedure, "folder" | "steps">;
}) {
  return (
    <span className="mt-1 flex flex-col gap-1.5">
      <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 self-start rounded-md border px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
        <Folder className="size-3 shrink-0" />
        {lessonScope(procedure.folder)}
      </span>
      {procedure.steps.length > 0 && (
        <ol className="list-decimal pl-4 text-xs text-muted-foreground">
          {procedure.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </span>
  );
}
