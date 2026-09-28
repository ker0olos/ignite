import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * One choice in a question: a radio, or a checkbox when several may be
 * picked. Once picked, it takes a note for the agent.
 */
export function QuestionOption({
  label,
  description,
  multi,
  picked,
  note,
  onClick,
  onNote,
}: {
  label: string;
  description?: string;
  multi: boolean;
  picked: boolean;
  note: string;
  onClick: () => void;
  onNote: (note: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        picked
          ? "border-primary bg-accent"
          : "border-border hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        role={multi ? "checkbox" : "radio"}
        aria-checked={picked}
        onClick={onClick}
        className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left"
      >
        <span
          className={cn(
            "mt-0.5 flex size-3.5 shrink-0 items-center justify-center border",
            multi ? "rounded-[3px]" : "rounded-full",
            picked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50",
          )}
        >
          {picked && <Check className="size-2.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-foreground">{label}</span>
          {description && (
            <span className="block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
      </button>
      {picked && (
        <div className="pr-2.5 pb-2 pl-8">
          <Textarea
            rows={1}
            aria-label={`Note on ${label}`}
            placeholder="Add a note for the agent (optional)"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            className="min-h-0 resize-none bg-background px-2.5 py-1.5 text-[13px] md:text-[13px] dark:bg-background"
          />
        </div>
      )}
    </div>
  );
}
