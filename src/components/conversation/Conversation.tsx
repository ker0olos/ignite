import { type RefObject, useRef } from "react";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import { RowBoundary } from "@/components/conversation/RowBoundary";
import { RowView } from "@/components/conversation/RowView";
import { RunIndicator } from "@/components/conversation/RunIndicator";
import { WaitingCallsContext, useWaitingOrder } from "@/hooks/useWaitingPlace";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { workingLine, writingText } from "@/lib/runStep";
import { shownItems } from "@/lib/routedMessage";
import type { Transcript } from "@/lib/transcript";
import { toRows, waitingCalls } from "@/lib/toolRows";
import type { CodeThemes } from "@/lib/codeThemes";

/** The conversation so far, auto-scrolling unless the user has scrolled up. */
export function Conversation({
  transcript,
  folder,
  editor,
  codeThemes,
  showThinking,
  stickyUserMessages,
  scrollRef,
  onApprove,
  waitingOnFork,
  shown,
}: {
  transcript: Transcript;
  /** Hidden, kept rendered: its waiting calls don't take the keyboard. */
  shown: boolean;
  /** A fork of it is open: the working line says so while it waits. */
  waitingOnFork?: boolean;
  showThinking: boolean;
  stickyUserMessages: boolean;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  scrollRef: RefObject<HTMLElement | null>;
  onApprove: ToolProps["onApprove"];
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const items = shownItems(transcript);
  const last = items.at(-1);
  useStickToBottom(scrollRef, contentRef, last);

  const waiting = useWaitingOrder(
    waitingCalls(transcript.items, transcript.tools),
    shown,
  );
  const working = workingLine(transcript, folder, showThinking, waitingOnFork);
  const rows = toRows(items, transcript.tools);

  return (
    <WaitingCallsContext.Provider value={waiting}>
      <div
        ref={contentRef}
        className="always-bounce mx-auto select-text max-w-3xl space-y-4 px-4 py-6 text-[13px]"
      >
        {rows.map((row, i) => (
          <RowBoundary key={i} resetOn={row}>
            <RowView
              row={row}
              tools={transcript.tools}
              folder={folder}
              editor={editor}
              codeThemes={codeThemes}
              stickyUserMessages={stickyUserMessages}
              onApprove={onApprove}
              last={i === rows.length - 1}
            />
          </RowBoundary>
        ))}
        {/* Hidden, its spinner and clock would tick for no one. */}
        {working && shown && !writingText(last) && (
          <RunIndicator
            state={waiting.length === 0 ? "working" : "waiting"}
            step={working.step}
            since={working.since}
            thought={working.thought}
          />
        )}
      </div>
    </WaitingCallsContext.Provider>
  );
}
