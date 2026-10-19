import { ArrowLeftRight, GraduationCap } from "lucide-react";
import { LessonTags } from "@/components/lessons/LessonTags";
import type { LessonAdded } from "../../../shared/lessons";

/** A saved lesson_add call: the lesson, the one it replaced struck through, and where it applies. */
export function LessonCard({ lesson, replaced }: LessonAdded) {
  const Icon = replaced === undefined ? GraduationCap : ArrowLeftRight;
  return (
    <section>
      <h3 className="mb-1.5 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {replaced === undefined ? "Lesson saved" : "Lesson replaced"}
      </h3>
      <div className="flex gap-2.5 rounded-[10px] border border-border bg-card px-3 py-2.5">
        <span className="grid size-6.5 shrink-0 place-items-center rounded-md bg-muted">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 break-words">
          {replaced !== undefined && (
            <p className="mb-1 text-muted-foreground line-through">
              {replaced}
            </p>
          )}
          <p className="text-foreground">{lesson.text}</p>
          <LessonTags lesson={lesson} />
        </div>
      </div>
    </section>
  );
}
