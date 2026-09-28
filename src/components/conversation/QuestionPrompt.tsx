import { useState } from "react";
import type { Question, QuestionAnswer } from "../../../shared/questions";
import { QuestionCard } from "@/components/conversation/QuestionCard";
import { Button } from "@/components/ui/button";
import { type Draft, EMPTY_DRAFT, toAnswers } from "@/lib/questions";

/** The agent's questions, waiting for the user's answers or for them to leave it be. */
export function QuestionPrompt({
  questions,
  onAnswer,
}: {
  questions: Question[];
  onAnswer: (approved: boolean, answers?: QuestionAnswer[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    questions.map(() => EMPTY_DRAFT),
  );
  const change = (i: number) => (draft: Draft) =>
    setDrafts((all) => all.map((d, j) => (j === i ? draft : d)));

  return (
    <div className="space-y-2 text-[13px]">
      {questions.map((question, i) => (
        <QuestionCard
          key={i}
          question={question}
          draft={drafts[i] ?? EMPTY_DRAFT}
          onChange={change(i)}
        />
      ))}
      <div className="flex gap-1.5">
        <Button
          size="xs"
          onClick={() => onAnswer(true, toAnswers(questions, drafts))}
        >
          Send answers
        </Button>
        <Button size="xs" variant="outline" onClick={() => onAnswer(false)}>
          Let the agent decide
        </Button>
      </div>
    </div>
  );
}
