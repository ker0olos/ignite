import type { Question } from "../../../shared/questions";
import { QuestionOption } from "@/components/conversation/QuestionOption";
import { Textarea } from "@/components/ui/textarea";
import { type Draft, OTHER, toggle, typeOther } from "@/lib/questions";
import { cn } from "@/lib/utils";

const FIELD = "min-h-0 resize-none px-2.5 py-1.5 text-[13px] md:text-[13px]";

/** One of the agent's questions: its options, an answer of the user's own, and a note. */
export function QuestionCard({
  question,
  draft,
  onChange,
}: {
  question: Question;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const multi = !!question.multiSelect;
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="space-y-0.5">
        {question.header && (
          <p className="text-xs font-medium text-muted-foreground">
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
            onClick={() => onChange(toggle(draft, option.label, multi))}
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
          FIELD,
          draft.picked.includes(OTHER) && draft.other && "border-primary",
        )}
      />
      <Textarea
        rows={1}
        aria-label="Note for the agent"
        placeholder="Add a note for the agent (optional)"
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        className={FIELD}
      />
    </div>
  );
}
