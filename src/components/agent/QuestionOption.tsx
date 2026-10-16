import { Check } from "lucide-react";
import { Kbd } from "@/components/agent/Kbd";
import { cn } from "@/lib/utils";

/** One choice in a question: a radio, or a checkbox when several may be picked. */
export function QuestionOption({
  label,
  description,
  multi,
  picked,
  hint,
  onClick,
  onFocus,
  onBlur,
}: {
  label: string;
  description?: string;
  multi: boolean;
  picked: boolean;
  /** The key that reaches or picks it from the focused option. */
  hint?: string;
  onClick: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={picked}
      data-question-item
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors",
        picked ? "bg-accent" : "hover:bg-accent/50",
        "focus-visible:ring-1 focus-visible:ring-ring",
      )}
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
        <span className="block font-medium text-foreground">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {hint && (
        <Kbd aria-hidden className="ml-auto shrink-0 self-center">
          {hint}
        </Kbd>
      )}
    </button>
  );
}
