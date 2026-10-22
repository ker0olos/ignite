import { useState } from "react";
import { MAX_REFLECTION_CHARS } from "../../../shared/reflector";
import { Textarea } from "@/components/ui/textarea";

/** A point's text, edited in place: Enter or blur saves a change, Esc or emptying it cancels. */
export function ReflectionText({
  text,
  onSave,
}: {
  text: string;
  onSave: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <button
        type="button"
        title="Edit"
        className="w-full cursor-text rounded-sm text-left text-[13px] break-words"
        onClick={() => setDraft(text)}
      >
        {text}
      </button>
    );
  }
  // Emptied text puts the point back; removing one goes through its Remove button, which asks first.
  const finish = () => {
    const next = draft.trim();
    if (next && next !== text) onSave(next);
    setDraft(null);
  };
  return (
    <Textarea
      autoFocus
      aria-label="Edit this point"
      className="min-h-16 text-[13px] md:text-[13px]"
      value={draft}
      maxLength={MAX_REFLECTION_CHARS}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(null);
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish();
        }
      }}
    />
  );
}
