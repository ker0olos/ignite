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
import { workingLine, writingText } from "@/lib/runStep";
import type { Item, Transcript } from "@/lib/transcript";
import { toRows, type Row } from "@/lib/toolRows";
import { editableEntries } from "@/lib/rewind";
import { editOriginals } from "@/lib/media";
import type { CodeThemes } from "@/lib/codeThemes";

// Tool rows' tiles sit in the margin, so their titles and cards share the text's edge,
// once the pane (a container) has room for them beside the column.
const marginTiles = (row: Row) =>
  row.kind === "tool" || row.kind === "calls"
    ? "@min-[860px]:-ml-11"
    : undefined;

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

  return (
    <WaitingCallsContext.Provider value={waiting}>
      <EditOriginalsContext.Provider value={originals}>
        <div
          ref={contentRef}
          className="always-bounce mx-auto select-text max-w-3xl space-y-[18px] px-4 py-6 text-[13px]"
        >
          {start > 0 && <div ref={topRef} />}
          {rows.slice(start).map((row, j) => {
            const view = (
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
            );
            // Only tool rows are wrapped: a sticky user message must stay a direct child.
            const outdent = marginTiles(row);
            return (
              <RowBoundary key={start + j} resetOn={row}>
                {outdent ? <div className={outdent}>{view}</div> : view}
              </RowBoundary>
            );
          })}
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
