import { Button } from "@/components/ui/button";
import { approvalHints } from "@/lib/approvalKeys";

/** The question deck's buttons: back, on (next or send), and leaving it to the agent. */
export function QuestionActions({
  last,
  shortcuts,
  onBack,
  onNext,
  onSkip,
}: {
  last: boolean;
  /** Shows ⌘↩ and ⌘⌫ on the buttons they press. */
  shortcuts: boolean;
  /** Left out on the first question. */
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const hints = shortcuts ? approvalHints() : null;
  return (
    <div className="flex gap-1.5 pt-1">
      {onBack && (
        <Button size="sm" variant="outline" onClick={onBack}>
          Back
        </Button>
      )}
      <Button
        size="sm"
        aria-keyshortcuts={hints ? "Meta+Enter" : undefined}
        onClick={onNext}
      >
        {last ? "Send answers" : "Next"}
        {hints && (
          <span aria-hidden className="opacity-60">
            {hints.approve}
          </span>
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto"
        aria-keyshortcuts={hints ? "Meta+Backspace" : undefined}
        onClick={onSkip}
      >
        Let the agent decide
        {hints && (
          <span aria-hidden className="opacity-60">
            {hints.deny}
          </span>
        )}
      </Button>
    </div>
  );
}
