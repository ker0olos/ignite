import { Kbd } from "@/components/agent/Kbd";
import { ACTION } from "@/components/agent/styles";
import { shortcut } from "@/lib/approvalKeys";

const BUTTON =
  "flex items-center gap-2 text-muted-foreground outline-none hover:text-foreground focus-visible:underline";

/** The composer's buttons while it shows a question: stop, back, leaving it to the agent, and on (next or send). */
export function QuestionActions({
  last,
  onBack,
  onNext,
  onSkip,
  onStop,
}: {
  last: boolean;
  /** Left out on the first question. */
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
  onStop: () => void;
}) {
  return (
    <div className={`${ACTION} gap-4`}>
      <button type="button" className={BUTTON} onClick={onStop}>
        Stop <Kbd>esc</Kbd>
      </button>
      {onBack && (
        <button type="button" className={BUTTON} onClick={onBack}>
          Back
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        aria-keyshortcuts="Meta+Backspace"
        onClick={onSkip}
      >
        Let the agent decide <Kbd>{shortcut("⌫")}</Kbd>
      </button>
      <button
        type="button"
        className="flex items-center gap-2 outline-none hover:opacity-80 focus-visible:underline"
        aria-keyshortcuts="Meta+Enter"
        onClick={onNext}
      >
        {last ? "Send answers" : "Next"} <Kbd>↵</Kbd>
      </button>
    </div>
  );
}
