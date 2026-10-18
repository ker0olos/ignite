import { Lightbulb } from "lucide-react";
import { LessonProposal } from "@/components/agent/LessonProposal";
import { SkillProposal } from "@/components/agent/SkillProposal";
import type { Proposal } from "../../../shared/lessons";

/** Lessons and skill sections the reflector drew from the user's corrections, kept only if the user says so. */
export function LessonProposals({
  lessons,
  error,
  onAnswer,
}: {
  lessons: Proposal[];
  error: string | null;
  onAnswer: (lesson: string, keep: boolean) => void;
}) {
  if (!lessons.length) return null;
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="flex items-start gap-2 rounded-lg border p-2.5 text-[13px]">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Remember this next time?</p>
          <ul className="mt-2 space-y-2.5">
            {lessons.map((p) =>
              p.kind === "skill" ? (
                <SkillProposal
                  key={p.id}
                  proposal={p}
                  onAnswer={(keep) => onAnswer(p.id, keep)}
                />
              ) : (
                <LessonProposal
                  key={p.id}
                  lesson={p}
                  onAnswer={(keep) => onAnswer(p.id, keep)}
                />
              ),
            )}
          </ul>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
