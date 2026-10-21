import type { ToolCall } from "../../../shared/agentTypes";
import type { ArtifactPage } from "@/lib/artifact";
import { ShellEdits } from "@/components/conversation/ShellEdits";
import type { ToolProps } from "@/components/conversation/shared";
import { ToolArtifact } from "@/components/conversation/ToolArtifact";
import { ToolRunOutcome } from "@/components/conversation/ToolRunOutcome";
import type { ToolRun } from "@/lib/transcript";

/** What a tool call shows under its title: its artifact pages, else its run's outcome and the files a command changed. */
export function ToolOutcomeBody({
  call,
  pages,
  height,
  run,
  text,
  folder,
  editor,
  codeThemes,
  tools,
  onApprove,
}: Omit<ToolProps, "run"> & {
  call: ToolCall;
  pages: ArtifactPage[];
  height: unknown;
  run: ToolRun | undefined;
  text: string;
}) {
  if (pages.length > 0) {
    return (
      <ToolArtifact
        pages={pages}
        height={height}
        folder={folder}
        editor={editor}
        codeThemes={codeThemes}
      />
    );
  }
  if (!run) return null;
  return (
    <>
      <ToolRunOutcome
        call={call}
        run={run}
        text={text}
        editor={editor}
        codeThemes={codeThemes}
        folder={folder}
        tools={tools}
        onApprove={onApprove}
      />
      <ShellEdits run={run} editor={editor} codeThemes={codeThemes} />
    </>
  );
}
