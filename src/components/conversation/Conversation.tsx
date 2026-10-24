import { useMemo, type RefObject } from "react";
import {
  EditOriginalsContext,
  type Editor,
  type ToolProps,
} from "@/components/conversation/shared";
import { RowBoundary } from "@/components/conversation/RowBoundary";
import { RowView } from "@/components/conversation/RowView";
import { RunIndicator } from "@/components/conversation/RunIndicator";
import { WaitingCallsContext } from "@/hooks/useWaitingPlace";
import { useOlderRows } from "@/hooks/useOlderRows";
import { useWidePane } from "@/hooks/useWidePane";
import { workingLine, writingText } from "@/lib/runStep";
import type { Item, Transcript } from "@/lib/transcript";
import { toRows } from "@/lib/toolRows";
import { cn } from "@/lib/utils";
import { editableEntries } from "@/lib/rewind";
import { editOriginals } from "@/lib/media";
import type { CodeThemes } from "@/lib/codeThemes";

// Wide enough for the tiles beside the column: the column grows by a tile and its gap, and
// everything but tool rows is indented by as much, so titles and cards share the text's edge.
// Padding, not negative margins or a container query: WebKit loses the scroll place with those.
const WIDE_PANE = 860;
const WIDE = "max-w-[calc(48rem+44px)] [&>*:not([data-tool-row])]:pl-11";

/** The conversation so far, auto-scrolling unless the user has scrolled up. */
export function Conversation({
  transcript,
  items,
  folder,
  editor,
  codeThemes,
  showThinking,
  stickyUserMessages,
  scrollRef,
  contentRef,
  onApprove,
  waitingOnFork,
  shown,
  waiting,
}: {
  transcript: Transcript;
  /** Its items as shown (shownItems). */
  items: Item[];
  /** Hidden, kept rendered: it draws no working line. */
  shown: boolean;
  /** Its waiting calls in the order they began to wait; only the first takes the keyboard, none while hidden. */
  waiting: string[];
  /** A fork of it is open: the working line says so while it waits. */
  waitingOnFork?: boolean;
  showThinking: boolean;
  stickyUserMessages: boolean;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onApprove: ToolProps["onApprove"];
}) {
  const last = items.at(-1);

  const working = workingLine(transcript, folder, showThinking, waitingOnFork);
  const rows = toRows(items, transcript.tools);
  const editable = editableEntries(items);
  const originals = useMemo(
    () => editOriginals(items, transcript.tools),
    [items, transcript.tools],
  );
  const { start, topRef } = useOlderRows(scrollRef, rows.length, shown);
  const wide = useWidePane(scrollRef, WIDE_PANE);

  return (
    <WaitingCallsContext.Provider value={waiting}>
      <EditOriginalsContext.Provider value={originals}>
        <div
          ref={contentRef}
          className={cn(
            "always-bounce mx-auto select-text max-w-3xl space-y-[18px] px-4 py-6 text-[13px]",
            wide && WIDE,
          )}
        >
          {start > 0 && <div ref={topRef} />}
          {rows.slice(start).map((row, j) => (
            <RowBoundary key={start + j} resetOn={row}>
              <RowView
                row={row}
                tools={transcript.tools}
                folder={folder}
                editor={editor}
                codeThemes={codeThemes}
                stickyUserMessages={stickyUserMessages}
                onApprove={onApprove}
                last={start + j === rows.length - 1}
                editable={
                  row.kind === "user" && editable.has(row.message.entryId ?? "")
                }
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
      </EditOriginalsContext.Provider>
    </WaitingCallsContext.Provider>
  );
}
