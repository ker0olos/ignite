import { type ReactNode, useState } from "react";
import type { Question } from "../../../shared/questions";
import { QuestionOption } from "@/components/conversation/QuestionOption";
import { QuestionOwnAnswer } from "@/components/conversation/QuestionOwnAnswer";
import {
  type Draft,
  OTHER,
  optionHint,
  setNote,
  toggle,
  typeOther,
} from "@/lib/questions";

/** One of the agent's questions: its options (with notes once picked) and an answer of the user's own. */
export function QuestionCard({
  question,
  position,
  draft,
  shortcuts = false,
  onChange,
  children,
}: {
  question: Question;
  /** Where it is in the deck, e.g. "1/3". */
  position?: string;
  draft: Draft;
  /** Shows the keys that reach and send the user's own answer. */
  shortcuts?: boolean;
  onChange: (draft: Draft) => void;
  /** The deck's buttons. */
  children?: ReactNode;
}) {
  const multi = !!question.multiSelect;
  const [focused, setFocused] = useState<number | null>(null);
  return (
    <div className="relative z-10 space-y-2 rounded-lg border bg-card p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="space-y-0.5">
        {(position || question.header) && (
          <p className="flex gap-2 text-xs font-medium text-muted-foreground">
            {position && <span className="tabular-nums">{position}</span>}
            {question.header}
          </p>
        )}
        <p className="font-medium text-foreground">{question.question}</p>
        {multi && (
          <p className="text-xs text-muted-foreground">Pick any that apply.</p>
        )}
      </div>
      <div className="space-y-1">
        {question.options.map((option, i) => (
          <QuestionOption
            key={option.label}
            label={option.label}
            description={option.description}
            multi={multi}
            picked={draft.picked.includes(option.label)}
            note={draft.notes[option.label] ?? ""}
            hint={optionHint(i, focused)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            onClick={() => onChange(toggle(draft, option.label, multi))}
            onNote={(note) => onChange(setNote(draft, option.label, note))}
          />
        ))}
      </div>
      <QuestionOwnAnswer
        value={draft.other}
        picked={draft.picked.includes(OTHER)}
        shortcuts={shortcuts}
        onChange={(other) => onChange(typeOther(draft, other, multi))}
      />
      {children}
    </div>
  );
}
