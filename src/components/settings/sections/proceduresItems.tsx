import { Folder } from "lucide-react";
import { ProcedureSteps } from "@/components/procedures/ProcedureSteps";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import { LearnedSource } from "@/components/settings/LearnedSource";
import type { Item } from "@/components/settings/sections";
import type { useProcedures } from "@/hooks/useProcedures";
import { noMatchItem } from "@/components/settings/sections/noMatchItem";
import { filterProcedures } from "@/lib/learningFilters";
import { lessonScope } from "@/lib/lessons";
import { procedureOrigin } from "@/lib/procedures";

/** Settings rows for the procedures learned from commands that failed. */
export function proceduresItems({
  procedures,
  onOpenConversation,
  searching = false,
}: {
  procedures: ReturnType<typeof useProcedures>;
  onOpenConversation: (folder: string, conversation: string) => void;
  /** Settings is searched, which may have matched a step. */
  searching?: boolean;
}): Item[] {
  if (procedures.error) {
    return [
      {
        section: "Procedures",
        title: "Something went wrong",
        description: procedures.error,
      },
    ];
  }
  if (procedures.procedures?.length === 0) {
    return [
      {
        section: "Procedures",
        title: "No procedures yet",
        description:
          "When a command fails and the agent finds its way past it, how it did that lands here.",
      },
    ];
  }
  const shown = filterProcedures(
    procedures.procedures ?? [],
    procedures.query,
    procedures.filter,
  );
  if (procedures.procedures?.length && shown.length === 0) {
    return [noMatchItem("Procedures", "No procedures match.")];
  }
  // The sidecar lists them newest first.
  return shown.map((p) => ({
    section: "Procedures",
    title: p.title,
    hint: <ProcedureSteps steps={p.steps} open={searching} />,
    id: `procedure-${p.id}`,
    alignTop: true,
    keywords: `procedure fix failed command steps how-to ${lessonScope(p.folder)} ${p.steps.join(" ")}`,
    control: (
      <span className="flex items-start gap-4">
        <span className="flex w-44 flex-col items-end gap-1 text-right">
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
            <Folder className="size-3 shrink-0" />
            {lessonScope(p.folder)}
          </span>
          <LearnedSource
            from={p.from}
            how="Learned"
            {...procedureOrigin(p)}
            onOpenConversation={onOpenConversation}
          />
        </span>
        <RemoveButton
          name="this procedure"
          onConfirm={() => void procedures.remove(p.id)}
          description="The agent is no longer offered it, so it may have to find this fix again."
        />
      </span>
    ),
  }));
}
