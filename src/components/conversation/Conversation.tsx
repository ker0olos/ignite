import { type RefObject, useRef } from "react";
import type { AssistantMessage } from "../../../shared/agentTypes";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import { RowBoundary } from "@/components/conversation/RowBoundary";
import { RowView } from "@/components/conversation/RowView";
import { RunIndicator } from "@/components/conversation/RunIndicator";
import { FirstApprovalContext } from "@/hooks/useFirstApproval";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { workingLine } from "@/lib/runStep";
import type { Transcript } from "@/lib/transcript";
import { firstWaiting, toRows } from "@/lib/toolRows";
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
}: {
  transcript: Transcript;
  showThinking: boolean;
  stickyUserMessages: boolean;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  scrollRef: RefObject<HTMLElement | null>;
  onApprove: ToolProps["onApprove"];
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const last = transcript.items.at(-1);
  useStickToBottom(scrollRef, contentRef, last);
  const lastMessage =
    last?.kind === "message" ? (last.message as AssistantMessage) : null;
  const lastIsStreamingText =
    lastMessage?.role === "assistant" &&
    lastMessage.stopReason === "pending" &&
    lastMessage.content.at(-1)?.type === "text";

  const waiting = firstWaiting(transcript.items, transcript.tools);
  const working = workingLine(transcript, folder, showThinking);

  return (
    <FirstApprovalContext.Provider value={waiting}>
      <div
        ref={contentRef}
        className="always-bounce mx-auto select-text max-w-3xl space-y-4 px-4 py-6 text-[13px]"
      >
        {toRows(transcript.items, transcript.tools).map((row, i) => (
          <RowBoundary key={i} resetOn={row}>
            <RowView
              row={row}
              tools={transcript.tools}
              folder={folder}
              editor={editor}
              codeThemes={codeThemes}
              stickyUserMessages={stickyUserMessages}
              onApprove={onApprove}
            />
          </RowBoundary>
        ))}
        {working && !lastIsStreamingText && (
          <RunIndicator
            state={waiting === null ? "working" : "waiting"}
            step={working.step}
            since={working.since}
            thought={working.thought}
          />
        )}
      </div>
    </FirstApprovalContext.Provider>
  );
}
