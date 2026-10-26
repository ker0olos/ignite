import { X } from "lucide-react";
import { ProcedureSteps } from "@/components/procedures/ProcedureSteps";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import { LearnedSource } from "@/components/settings/LearnedSource";
import type { Item } from "@/components/settings/sections";
import type { useProcedures } from "@/hooks/useProcedures";
import { lessonScope } from "@/lib/lessons";
import { procedureOrigin } from "@/lib/procedures";

/** Settings rows for the procedures learned from commands that failed. */
export function proceduresItems({
  procedures,
  onOpenConversation,
}: {
  procedures: ReturnType<typeof useProcedures>;
  onOpenConversation: (folder: string, conversation: string) => void;
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
  // The sidecar lists them newest first.
  return (procedures.procedures ?? []).map((p) => ({
    section: "Procedures",
    title: p.title,
    hint: <ProcedureSteps procedure={p} />,
    id: `procedure-${p.id}`,
    alignTop: true,
    keywords: `procedure fix failed command steps how-to ${lessonScope(p.folder)} ${p.steps.join(" ")}`,
    control: (
      <span className="flex items-start gap-5">
        <LearnedSource
          from={p.from}
          how="Learned"
          {...procedureOrigin(p)}
          onOpenConversation={onOpenConversation}
        />
        <RemoveButton
          name="this procedure"
          onConfirm={() => void procedures.remove(p.id)}
          description="The agent is no longer offered it, so it may have to find this fix again."
          variant="outline"
          icon={<X />}
        />
      </span>
    ),
  }));
}
