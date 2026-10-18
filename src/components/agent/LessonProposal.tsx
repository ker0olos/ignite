import { LessonTags } from "@/components/lessons/LessonTags";
import { Button } from "@/components/ui/button";
import type { ProposedLesson } from "../../../shared/lessons";

/** One lesson the reflector proposes: what it says, where it applies, why, and Keep or Discard. */
export function LessonProposal({
  lesson,
  onAnswer,
}: {
  lesson: ProposedLesson;
  onAnswer: (keep: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p>{lesson.text}</p>
        <LessonTags
          lesson={{ ...lesson, folder: lesson.folderOnly ? "" : undefined }}
        />
        {lesson.evidence && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            {lesson.evidence}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" onClick={() => onAnswer(true)}>
          Keep
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAnswer(false)}>
          Discard
        </Button>
      </div>
    </li>
  );
}
