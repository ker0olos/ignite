import { useRef } from "react";
import { Composer } from "@/components/agent/Composer";
import { ConversationMenu } from "@/components/agent/ConversationMenu";
import { ConversationSkeleton } from "@/components/agent/ConversationSkeleton";
import { EmptyConversation } from "@/components/agent/EmptyConversation";
import { TrustPrompt } from "@/components/agent/TrustPrompt";
import { Conversation } from "@/components/conversation/Conversation";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import type { Approval } from "@/components/agent/Composer";

type Session = ReturnType<typeof useAgentSession>;

/** Conversation area and task composer. */
export function AgentPanel({
  folder,
  session,
  codeThemes,
  editor,
  showThinking,
  approval,
}: {
  folder: string;
  session: Session;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  showThinking: boolean;
  approval: Approval;
}) {
  const { state, transcript } = session;
  const mainRef = useRef<HTMLElement>(null);
  const running = transcript?.running ?? false;
  const loading = !state && !session.error;

  return (
    <>
      {!loading && (
        <ConversationMenu
          running={running}
          onClear={() => void session.clear()}
        />
      )}
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
            onApprove={session.answer}
          />
        ) : (
          <EmptyConversation folder={folder} />
        )}
      </main>
      {session.trust === "ask" && (
        <TrustPrompt onAnswer={(trusted) => void session.setTrust(trusted)} />
      )}
      <Composer
        session={session}
        loading={loading}
        running={running}
        approval={approval}
      />
    </>
  );
}
