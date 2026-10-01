import { RunIndicator } from "@/components/conversation/RunIndicator";
import { SubagentBody } from "@/components/conversation/SubagentBody";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import { runState, subagentConversation } from "@/lib/subagentRows";

/** A subagent's whole conversation, live while its conversation shows, ending in where it stands: working, waiting or finished. */
export function SubagentView({
  owner,
  id,
  model,
  folder,
  session,
  editor,
  codeThemes,
}: {
  /** The conversation that started it. */
  owner: string;
  id: string;
  model: string;
  folder: string;
  session: ReturnType<typeof useAgentSession>;
  editor: Settings["editor"];
  codeThemes: CodeThemes;
}) {
  const transcript = session.session === owner ? session.transcript : null;
  const details = transcript && subagentConversation(transcript, id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 pr-2 pl-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{id}</span>
        <span className="min-w-0 flex-1 truncate">{model}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 text-[13px]">
        {details ? (
          <>
            <SubagentBody
              details={details}
              tools={transcript.tools}
              folder={folder}
              editor={editor}
              codeThemes={codeThemes}
              onApprove={session.answer}
            />
            <div className="mt-4">
              <RunIndicator state={runState(details, transcript.tools)} />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            {transcript
              ? "It hasn't reported anything yet."
              : "Show its conversation to follow it here."}
          </p>
        )}
      </div>
    </div>
  );
}
