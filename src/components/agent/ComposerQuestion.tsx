import { type KeyboardEvent, type Ref, useState } from "react";
import { QuestionOption } from "@/components/agent/QuestionOption";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";
import { noteLabel, optionHint, pickHint } from "@/lib/questions";

/** The question the composer answers: its line, its options, and what the composer's text will be. */
export function ComposerQuestion({
  deck,
  ref,
  onKeyDown,
}: {
  deck: QuestionDeck;
  /** The options, which the composer's keys move between. */
  ref: Ref<HTMLDivElement>;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const { question, step, count, draft } = deck;
  const multi = !!question.multiSelect;
  const [focused, setFocused] = useState<number | null>(null);
  const note = noteLabel(draft.picked);
  return (
    <div className="pt-3 text-[13px] animate-in fade-in duration-200">
      <div className="flex items-baseline gap-2.5 px-0.5 pb-2">
        {count > 1 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {step + 1}/{count}
          </span>
        )}
        {question.header && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {question.header}
          </span>
        )}
        <span className="font-semibold text-foreground">
          {question.question}
        </span>
        {multi && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            Pick any that apply
          </span>
        )}
      </div>
      <div
        ref={ref}
        role={multi ? "group" : "radiogroup"}
        aria-label={question.question}
        className="space-y-0.5"
        onKeyDown={onKeyDown}
      >
        {question.options.map((option, i) => (
          <QuestionOption
            key={option.label}
            label={option.label}
            description={option.description}
            multi={multi}
            picked={draft.picked.includes(option.label)}
            hint={optionHint(i, focused) ?? pickHint(i)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            onClick={() => deck.toggle(option.label)}
          />
        ))}
      </div>
      <div className="mx-0.5 mt-2.5 border-t border-dashed" />
      {note && (
        <p className="truncate px-0.5 pt-2.5 text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
