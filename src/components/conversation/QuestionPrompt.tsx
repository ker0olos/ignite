import { useState } from "react";
import type { Question, QuestionAnswer } from "../../../shared/questions";
import { QuestionCard } from "@/components/conversation/QuestionCard";
import { Button } from "@/components/ui/button";
import { type Draft, EMPTY_DRAFT, toAnswers } from "@/lib/questions";

/** The agent's questions as a deck of cards, one at a time, the rest peeking out below. */
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
  const [step, setStep] = useState(0);
  const last = step >= questions.length - 1;
  const behind = Math.min(questions.length - 1 - step, 2);
  const change = (draft: Draft) =>
    setDrafts((all) => all.map((d, i) => (i === step ? draft : d)));

  if (!questions[step]) return null;
  return (
    <div className="text-[13px]">
      <QuestionCard
        key={step}
        question={questions[step]}
        position={
          questions.length > 1 ? `${step + 1}/${questions.length}` : undefined
        }
        draft={drafts[step] ?? EMPTY_DRAFT}
        onChange={change}
      >
        <div className="flex gap-1.5 pt-1">
          {step > 0 && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          {last ? (
            <Button
              size="xs"
              onClick={() => onAnswer(true, toAnswers(questions, drafts))}
            >
              Send answers
            </Button>
          ) : (
            <Button size="xs" onClick={() => setStep(step + 1)}>
              Next
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            onClick={() => onAnswer(false)}
          >
            Let the agent decide
          </Button>
        </div>
      </QuestionCard>
      {behind > 0 && (
        <div
          aria-hidden
          className="mx-2 h-1.5 rounded-b-lg border border-t-0 bg-card"
        />
      )}
      {behind > 1 && (
        <div
          aria-hidden
          className="mx-4 h-1.5 rounded-b-lg border border-t-0 bg-card/60"
        />
      )}
    </div>
  );
}
