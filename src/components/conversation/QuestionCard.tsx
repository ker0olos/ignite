import type { ReactNode } from "react";
import type { Question } from "../../../shared/questions";
import { QuestionOption } from "@/components/conversation/QuestionOption";
import { Textarea } from "@/components/ui/textarea";
import { type Draft, OTHER, setNote, toggle, typeOther } from "@/lib/questions";
import { cn } from "@/lib/utils";

/** One of the agent's questions: its options (with notes once picked) and an answer of the user's own. */
export function QuestionCard({
  question,
  position,
  draft,
  onChange,
  children,
}: {
  question: Question;
  /** Where it is in the deck, e.g. "1/3". */
  position?: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** The deck's buttons. */
  children?: ReactNode;
}) {
  const multi = !!question.multiSelect;
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
        {question.options.map((option) => (
          <QuestionOption
            key={option.label}
            label={option.label}
            description={option.description}
            multi={multi}
            picked={draft.picked.includes(option.label)}
            note={draft.notes[option.label] ?? ""}
            onClick={() => onChange(toggle(draft, option.label, multi))}
            onNote={(note) => onChange(setNote(draft, option.label, note))}
          />
        ))}
      </div>
      <Textarea
        rows={1}
        aria-label="Your own answer"
        placeholder="Or write your own answer"
        value={draft.other}
        onChange={(e) => onChange(typeOther(draft, e.target.value, multi))}
        className={cn(
          "min-h-0 resize-none px-2.5 py-1.5 text-[13px] md:text-[13px]",
          draft.picked.includes(OTHER) && draft.other && "border-primary",
        )}
      />
      {children}
    </div>
  );
}
