import { type RefObject, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { AssistantMessage } from "../../../shared/agentTypes";
import type { Editor } from "@/components/conversation/shared";
import { RowView } from "@/components/conversation/RowView";
import type { Transcript } from "@/lib/transcript";
import { toRows } from "@/lib/toolRows";
import type { CodeThemes } from "@/lib/codeThemes";

/** The conversation so far, auto-scrolling unless the user has scrolled up. */
export function Conversation({
  transcript,
  folder,
  editor,
  codeThemes,
  showThinking,
  scrollRef,
}: {
  transcript: Transcript;
  showThinking: boolean;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const stuck = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  });

  const last = transcript.items.at(-1);
  const lastMessage =
    last?.kind === "message" ? (last.message as AssistantMessage) : null;
  const lastIsStreamingText =
    lastMessage?.role === "assistant" &&
    lastMessage.stopReason === "pending" &&
    lastMessage.content.at(-1)?.type === "text";

  return (
    <div className="always-bounce mx-auto max-w-3xl space-y-4 px-4 py-6 text-[13px]">
      {toRows(transcript.items, showThinking).map((row, i) => (
        <RowView
          key={i}
          row={row}
          tools={transcript.tools}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      ))}
      {transcript.running && !lastIsStreamingText && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Working…
        </div>
      )}
    </div>
  );
}
