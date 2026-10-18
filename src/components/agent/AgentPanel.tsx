import { Composer } from "@/components/agent/Composer";
import { ConversationSkeleton } from "@/components/agent/ConversationSkeleton";
import { EmptyConversation } from "@/components/agent/EmptyConversation";
import { TrustPrompt } from "@/components/agent/TrustPrompt";
import { ConversationPane } from "@/components/agent/ConversationPane";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useQuestionDeck, useWaitingCalls } from "@/hooks/useQuestionDeck";
import { askingCall } from "@/lib/questions";
import type { CodeThemes } from "@/lib/codeThemes";
import { shownItems } from "@/lib/routedMessage";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { Approval, ModelRouter } from "@/components/agent/Composer";

type Session = ReturnType<typeof useAgentSession>;

// A hidden conversation sends nothing; the same function keeps it from re-rendering.
const idle = () => {};
// A hidden conversation's calls wait unseen, so none takes the keyboard.
const NONE: string[] = [];

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
  modelRouter,
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
  modelRouter: ModelRouter;
}) {
  const { state, transcript } = session;
  const running = !!transcript?.running;
  // A folder with no conversation looks like a new one; sending starts it.
  const loading = !state && !session.error && !session.none;
  // A reopened conversation reads while its session still starts.
  const panes = session.kept.filter((o) => shownItems(o.transcript).length);
  const covered = panes.some((o) => o.session === session.session);
  const waiting = useWaitingCalls(transcript);
  const asking = useQuestionDeck(
    transcript ? askingCall(transcript.items, waiting) : undefined,
    session.answer,
  );

  return (
    <>
      <div className="relative min-h-0 flex-1">
        {panes.map((o) => {
          const shown = o.session === session.session;
          return (
            <ConversationPane
              // The opened conversation replaces its preview drawn afresh, from its newest rows.
              key={o.preview ? `${o.session} preview` : o.session}
              transcript={o.transcript}
              session={o.session}
              folder={o.folder}
              shown={shown}
              send={shown ? session.send : idle}
              skipWait={session.skipWait}
              onApprove={session.answer}
              waitingOnFork={shown && session.waitingOnFork}
              waiting={shown ? waiting : NONE}
              askingStep={shown && asking ? asking.step : 0}
              editor={editor}
              codeThemes={codeThemes}
              showThinking={showThinking}
              stickyUserMessages={stickyUserMessages}
            />
          );
        })}
        {!covered && (
          <main className="absolute inset-0 overscroll-contain overflow-y-auto">
            {loading ? (
              <ConversationSkeleton />
            ) : (
              <EmptyConversation folder={folder} />
            )}
          </main>
        )}
      </div>
      {session.trust === "ask" && (
        <TrustPrompt onAnswer={(trusted) => void session.setTrust(trusted)} />
      )}
      <Composer
        host={host}
        folder={folder}
        session={session}
        running={running}
        asking={asking}
        approval={approval}
        modelRouter={modelRouter}
        gitStatus={gitStatus}
      />
    </>
  );
}
