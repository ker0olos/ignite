import { memo, useMemo, useRef } from "react";
import { Conversation } from "@/components/conversation/Conversation";
import {
  AskingStepContext,
  ContinueContext,
  MessageEditContext,
  RunningContext,
  SkipWaitContext,
  type Editor,
  type MessageEdit,
  type ToolProps,
} from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Transcript } from "@/lib/transcript";
import { canRewind } from "@/lib/rewind";
import { cn } from "@/lib/utils";

/**
 * One conversation's scrolling view. Recently shown ones stay mounted and
 * hidden, so showing one again keeps its rows and scroll and costs no render.
 */
export const ConversationPane = memo(function ConversationPane({
  transcript,
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
  rewind,
  filesStay,
}: {
  transcript: Transcript;
  /** Edits one of its user messages; unset while hidden. */
  rewind?: MessageEdit["edit"];
  /** Its agent works in the folder itself, so editing leaves the files. */
  filesStay: boolean;
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
  const disabled = !canRewind(transcript, waitingOnFork);
  const edit = useMemo(
    () => rewind && { edit: rewind, disabled, filesStay },
    [rewind, disabled, filesStay],
  );
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
      <SkipWaitContext.Provider value={skipWait}>
        <ContinueContext.Provider
          value={running ? null : () => void send("Continue")}
        >
          <RunningContext.Provider value={running}>
            <AskingStepContext.Provider value={askingStep}>
              <MessageEditContext.Provider value={edit ?? null}>
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
              </MessageEditContext.Provider>
            </AskingStepContext.Provider>
          </RunningContext.Provider>
        </ContinueContext.Provider>
      </SkipWaitContext.Provider>
    </main>
  );
});
