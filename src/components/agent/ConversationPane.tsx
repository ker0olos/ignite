import { memo, useRef } from "react";
import { Conversation } from "@/components/conversation/Conversation";
import {
  AskingStepContext,
  ContinueContext,
  ConversationIdContext,
  RunningContext,
  SkipWaitContext,
  type Editor,
  type ToolProps,
} from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Transcript } from "@/lib/transcript";
import { cn } from "@/lib/utils";

/**
 * One conversation's scrolling view. Recently shown ones stay mounted and
 * hidden, so showing one again keeps its rows and scroll and costs no render.
 */
export const ConversationPane = memo(function ConversationPane({
  transcript,
  session,
  folder,
  shown,
  send,
  skipWait,
  onApprove,
  waitingOnFork,
  waiting,
  askingStep,
  editor,
  codeThemes,
  showThinking,
  stickyUserMessages,
}: {
  transcript: Transcript;
  /** Its id; null for a new one. */
  session: string | null;
  folder: string;
  shown: boolean;
  send: (text: string) => unknown;
  skipWait: (toolCallId: string) => Promise<boolean>;
  onApprove: ToolProps["onApprove"];
  waitingOnFork: boolean;
  /** Its waiting calls in the order they began to wait; none while hidden. */
  waiting: string[];
  /** Which question of the composer's the user is on. */
  askingStep: number;
  editor: Editor;
  codeThemes: CodeThemes;
  showThinking: boolean;
  stickyUserMessages: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const running = !!transcript.running;
  return (
    <main
      ref={ref}
      inert={!shown}
      className={cn(
        // useStickToBottom keeps the place; the browser's anchoring would move it on a resize.
        "absolute inset-0 overscroll-contain overflow-y-auto [overflow-anchor:none]",
        !shown && "invisible",
      )}
    >
      <ConversationIdContext.Provider value={session}>
        <SkipWaitContext.Provider value={skipWait}>
          <ContinueContext.Provider
            value={running ? null : () => void send("Continue")}
          >
            <RunningContext.Provider value={running}>
              <AskingStepContext.Provider value={askingStep}>
                <Conversation
                  transcript={transcript}
                  folder={folder}
                  shown={shown}
                  editor={editor}
                  codeThemes={codeThemes}
                  showThinking={showThinking}
                  stickyUserMessages={stickyUserMessages}
                  scrollRef={ref}
                  waiting={waiting}
                  onApprove={onApprove}
                  waitingOnFork={waitingOnFork}
                />
              </AskingStepContext.Provider>
            </RunningContext.Provider>
          </ContinueContext.Provider>
        </SkipWaitContext.Provider>
      </ConversationIdContext.Provider>
    </main>
  );
});
