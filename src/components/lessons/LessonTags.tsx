import { Ban, Folder, Globe, MessageSquare, Wrench } from "lucide-react";
import type { Lesson } from "../../../shared/lessons";
import { lessonScope } from "@/lib/lessons";
import { cn } from "@/lib/utils";

const tag =
  "inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border px-1.5 py-0.5 text-[11px] leading-4";

/** A lesson's tags: the folder it applies to, and what brings it up (a blocked call, a tool, every conversation). */
export function LessonTags({
  lesson,
  hits,
}: {
  lesson: Pick<Lesson, "level" | "tool" | "match" | "regex"> & {
    folder?: string;
  };
  hits?: number;
}) {
  const { level, tool, match, folder } = lesson;
  const Scope = folder === undefined ? Globe : Folder;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={cn(tag, "text-muted-foreground")}>
        <Scope className="size-3 shrink-0" />
        {lessonScope(folder)}
      </span>
      {level === "system_prompt" ? (
        <span className={cn(tag, "bg-muted text-foreground")}>
          <MessageSquare className="size-3 shrink-0" />
          Every conversation
        </span>
      ) : match ? (
        <span
          className={cn(
            tag,
            "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          <Ban className="size-3 shrink-0" />
          Blocks
          <code className="min-w-0 font-mono break-words">{tool}</code>
          {lesson.regex ? "matching" : "with"}
          <code className="min-w-0 font-mono break-words">
            {lesson.regex ? `/${match}/` : `“${match}”`}
          </code>
        </span>
      ) : (
        <span className={cn(tag, "bg-muted text-foreground")}>
          <Wrench className="size-3 shrink-0" />
          Before
          <code className="min-w-0 font-mono break-words">{tool}</code>
        </span>
      )}
      {!!hits && (
        <span className="text-[11px] text-muted-foreground">
          came up {hits}×
        </span>
      )}
    </span>
  );
}
