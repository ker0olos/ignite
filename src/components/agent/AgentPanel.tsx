import { useRef } from "react";
import { Composer } from "@/components/agent/Composer";
import { ConversationSkeleton } from "@/components/agent/ConversationSkeleton";
import { EmptyConversation } from "@/components/agent/EmptyConversation";
import { Conversation } from "@/components/conversation/Conversation";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";

type Session = ReturnType<typeof useAgentSession>;

/** Conversation area and task composer. */
export function AgentPanel({
  folder,
  session,
  codeThemes,
  editor,
  showThinking,
}: {
  folder: string;
  session: Session;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  showThinking: boolean;
}) {
  const { state, transcript } = session;
  const mainRef = useRef<HTMLElement>(null);
  const running = transcript?.running ?? false;
  const loading = !state && !session.error;

  return (
    <>
      <main
        ref={mainRef}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
      >
        {loading ? (
          <ConversationSkeleton />
        ) : transcript && transcript.items.length > 0 ? (
          <Conversation
            transcript={transcript}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
            showThinking={showThinking}
            scrollRef={mainRef}
          />
        ) : (
          <EmptyConversation folder={folder} />
        )}
      </main>
      <Composer session={session} loading={loading} running={running} />
    </>
  );
}
