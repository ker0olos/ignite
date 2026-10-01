import { useRef, useState } from "react";
import type { Question, QuestionAnswer } from "../../../shared/questions";
import { QuestionActions } from "@/components/conversation/QuestionActions";
import { QuestionCard } from "@/components/conversation/QuestionCard";
import { useQuestionKeys } from "@/hooks/useQuestionKeys";
import { type Draft, EMPTY_DRAFT, toAnswers } from "@/lib/questions";

/** The agent's questions as a deck of cards, one at a time, the rest peeking out below. */
export function QuestionPrompt({
  questions,
  shortcuts = false,
  onAnswer,
}: {
  questions: Question[];
  /** Takes the keyboard (⌘↩ on, ⌘⌫ skip), and shows it: only the first waiting call does. */
  shortcuts?: boolean;
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
  const next = () =>
    last ? onAnswer(true, toAnswers(questions, drafts)) : setStep(step + 1);
  const skip = () => onAnswer(false);
  const card = useRef<HTMLDivElement>(null);
  const onKeyDown = useQuestionKeys(card, shortcuts, step, next, skip);

  if (!questions[step]) return null;
  return (
    <div ref={card} className="text-[13px]" onKeyDown={onKeyDown}>
      <QuestionCard
        key={step}
        question={questions[step]}
        position={
          questions.length > 1 ? `${step + 1}/${questions.length}` : undefined
        }
        draft={drafts[step] ?? EMPTY_DRAFT}
        shortcuts={shortcuts}
        onChange={change}
      >
        <QuestionActions
          last={last}
          shortcuts={shortcuts}
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={next}
          onSkip={skip}
        />
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
