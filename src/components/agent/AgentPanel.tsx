import { useRef } from "react";
import { Composer } from "@/components/agent/Composer";
import { ConversationSkeleton } from "@/components/agent/ConversationSkeleton";
import { EmptyConversation } from "@/components/agent/EmptyConversation";
import { TrustPrompt } from "@/components/agent/TrustPrompt";
import { Conversation } from "@/components/conversation/Conversation";
import {
  ContinueContext,
  SkipWaitContext,
} from "@/components/conversation/shared";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { CodeThemes } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { Approval } from "@/components/agent/Composer";

type Session = ReturnType<typeof useAgentSession>;

/** Conversation area and task composer. */
export function AgentPanel({
  host,
  folder,
  session,
  codeThemes,
  editor,
  showThinking,
  stickyUserMessages,
  gitStatus,
  approval,
}: {
  host: HostClient | null;
  folder: string;
  session: Session;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  showThinking: boolean;
  stickyUserMessages: boolean;
  /** The composer lists the conversation's repositories with unfinished git work. */
  gitStatus: boolean;
  approval: Approval;
}) {
  const { state, transcript } = session;
  const mainRef = useRef<HTMLElement>(null);
  const running = transcript?.running ?? false;
  // A folder with no conversation looks like a new one; sending starts it.
  const loading = !state && !session.error && !session.none;

  return (
    <>
      <main
        ref={mainRef}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
      >
        {/* A reopened conversation reads while its session still starts. */}
        {transcript && transcript.items.length > 0 ? (
          <SkipWaitContext.Provider value={session.skipWait}>
            <ContinueContext.Provider
              value={running ? null : () => void session.send("Continue")}
            >
              <Conversation
                transcript={transcript}
                folder={folder}
                editor={editor}
                codeThemes={codeThemes}
                showThinking={showThinking}
                stickyUserMessages={stickyUserMessages}
                scrollRef={mainRef}
                onApprove={session.answer}
              />
            </ContinueContext.Provider>
          </SkipWaitContext.Provider>
        ) : loading ? (
          <ConversationSkeleton />
        ) : (
          <EmptyConversation folder={folder} />
        )}
      </main>
      {session.trust === "ask" && (
        <TrustPrompt onAnswer={(trusted) => void session.setTrust(trusted)} />
      )}
      <Composer
        host={host}
        folder={folder}
        session={session}
        loading={loading}
        running={running}
        approval={approval}
        gitStatus={gitStatus}
      />
    </>
  );
}
