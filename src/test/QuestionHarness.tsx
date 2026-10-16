import { useRef } from "react";
import type { ToolCall } from "../../shared/agentTypes";
import { ComposerQuestion } from "@/components/agent/ComposerQuestion";
import { QuestionActions } from "@/components/agent/QuestionActions";
import { useComposerQuestionKeys } from "@/hooks/useComposerQuestionKeys";
import { useQuestionDeck } from "@/hooks/useQuestionDeck";
import type { ToolProps } from "@/components/conversation/shared";

/** The composer's question pieces wired as Composer wires them, with a bare textarea in a form. */
export function QuestionHarness({
  call,
  onApprove,
}: {
  call: ToolCall;
  onApprove: ToolProps["onApprove"];
}) {
  const options = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const deck = useQuestionDeck(call, onApprove);
  const keys = useComposerQuestionKeys(deck, options, input);
  if (!deck) return null;
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <ComposerQuestion
        deck={deck}
        ref={options}
        onKeyDown={keys.onOptionKey}
      />
      <textarea
        ref={input}
        aria-label="Composer"
        value={deck.draft.text}
        onChange={(e) => deck.setText(e.target.value)}
        onKeyDown={(e) => void keys.onInputKey(e)}
      />
      <QuestionActions
        last={deck.last}
        onBack={deck.back}
        onNext={deck.next}
        onSkip={deck.skip}
        onStop={() => {}}
      />
    </form>
  );
}
