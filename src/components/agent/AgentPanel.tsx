import { useCallback } from "react";
import type { QuestionAnswer } from "../../../shared/questions";
import { Composer } from "@/components/agent/Composer";
import { ConversationSkeleton } from "@/components/agent/ConversationSkeleton";
import { EmptyConversation } from "@/components/agent/EmptyConversation";
import { TrustPrompt } from "@/components/agent/TrustPrompt";
import { ConversationPane } from "@/components/agent/ConversationPane";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useQuestionDeck, useWaitingCalls } from "@/hooks/useQuestionDeck";
import { takeComments } from "@/lib/diffCommentMessage";
import { askingCall, withAnswerComments } from "@/lib/questions";
import type { CodeThemes } from "@/lib/codeThemes";
import { shownItems } from "@/lib/routedMessage";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { Approval, ModelRouter } from "@/components/agent/Composer";
import { STARTING_PANE } from "@/lib/sessionEntry";
import { paneRoot } from "@/lib/worktreeLayout";

type Session = ReturnType<typeof useAgentSession>;

// A hidden conversation sends nothing; the same function keeps it from re-rendering.
const idle = () => {};
// A hidden conversation's calls wait unseen, so none takes the keyboard.
const NONE: string[] = [];

/** Conversation area and task composer. */
export function AgentPanel({
  host,
  folder,
  root,
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
  /** Where the shown conversation's files are, known before its session opens; null while unknown. */
  root: string | null;
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
  const { transcript } = session;
  const running = !!transcript?.running;
  // A folder with no conversation looks like a new one; sending starts it.
  const loading = !session.ready && !session.error && !session.none;
  // A reopened conversation reads while its session still starts.
  const panes = session.kept.filter((o) => shownItems(o.transcript).length);
  // A first message shows in a pane of its own until its conversation is known.
  const pane = session.session ?? STARTING_PANE;
  const covered = panes.some((o) => o.session === pane);
  const waiting = useWaitingCalls(transcript);
  // Sent with the questions if the user goes away before answering (sidecar/awayTimer.ts).
  const sendDraft = useCallback(
    (toolCallId: string, answers: QuestionAnswer[]) =>
      void host
        ?.send({ type: "question_draft", toolCallId, answers })
        .catch(() => {}),
    [host],
  );
  // Answering, the conversation's diff comments go with the answer, as they would with a message.
  const asking = useQuestionDeck(
    transcript ? askingCall(transcript.items, waiting) : undefined,
    (id, approved, answers, always) =>
      session.answer(
        id,
        approved,
        answers && withAnswerComments(answers, takeComments(session.session)),
        always,
      ),
    sendDraft,
    transcript?.tools,
  );

  return (
    <>
      <div className="relative min-h-0 flex-1">
        {panes.map((o) => {
          const shown = o.session === pane;
          return (
            <ConversationPane
              // The opened conversation replaces its preview drawn afresh, from its newest rows.
              key={o.preview ? `${o.session} preview` : o.session}
              transcript={o.transcript}
              session={o.session}
              folder={paneRoot(o, pane, root)}
              shown={shown}
              send={shown ? session.send : idle}
              skipWait={session.skipWait}
              onApprove={session.answer}
              waitingOnFork={shown && session.waitingOnFork}
              rewind={shown ? session.rewind : undefined}
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
