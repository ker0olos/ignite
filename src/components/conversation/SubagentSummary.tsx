import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { SubagentDetails } from "../../../shared/subagents";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import { SubagentBody } from "@/components/conversation/SubagentBody";
import type { CodeThemes } from "@/lib/codeThemes";
import { subagentSummary } from "@/lib/subagentRows";
import type { ToolRun } from "@/lib/transcript";
import { cn } from "@/lib/utils";

/** A subagent call as one line (its step and tool calls) that opens to its conversation; open while it waits for the user. */
export function SubagentSummary({
  details,
  tools,
  folder,
  editor,
  codeThemes,
  onApprove,
}: {
  /** Null while it's queued or its session opens. */
  details: SubagentDetails | null;
  tools: Record<string, ToolRun> | undefined;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  onApprove: ToolProps["onApprove"];
}) {
  const [opened, setOpened] = useState(false);
  if (!details) return <p className="text-xs">Waiting to start</p>;
  const { line, waiting } = subagentSummary(details, tools, folder);
  const open = opened || waiting;
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpened(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        {line}
      </button>
      {open && (
        <SubagentBody
          details={details}
          tools={tools}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
          onApprove={onApprove}
        />
      )}
    </div>
  );
}
