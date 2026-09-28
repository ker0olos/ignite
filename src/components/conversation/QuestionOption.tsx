import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** One choice in a question: a radio, or a checkbox when several may be picked. */
export function QuestionOption({
  label,
  description,
  multi,
  picked,
  onClick,
}: {
  label: string;
  description?: string;
  multi: boolean;
  picked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={picked}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors hover:bg-accent/50",
        picked ? "border-primary bg-accent" : "border-border",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center border",
          multi ? "rounded-sm" : "rounded-full",
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
  );
}
