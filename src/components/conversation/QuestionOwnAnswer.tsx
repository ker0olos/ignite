import { useState } from "react";
import { Kbd } from "@/components/agent/Kbd";
import { Textarea } from "@/components/ui/textarea";
import { approvalHints, shortcut } from "@/lib/approvalKeys";
import { cn } from "@/lib/utils";

/** The box for an answer of the user's own; with the shortcuts, ⌘N reaches it and ⌘↩ sends from it. */
export function QuestionOwnAnswer({
  value,
  picked,
  shortcuts,
  onChange,
}: {
  value: string;
  picked: boolean;
  shortcuts: boolean;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const hint = focused ? approvalHints().approve : shortcut("N");
  return (
    <div className="relative">
      <Textarea
        rows={1}
        aria-label="Your own answer"
        data-question-item
        data-own-answer
        placeholder="Or write your own answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          "min-h-0 resize-none px-2.5 py-1.5 text-[13px] md:text-[13px]",
          shortcuts && "pr-14",
          picked && value && "border-primary",
        )}
      />
      {shortcuts && (
        <Kbd
          aria-hidden
          className="pointer-events-none absolute top-1.5 right-2.5"
        >
          {hint}
        </Kbd>
      )}
    </div>
  );
}
