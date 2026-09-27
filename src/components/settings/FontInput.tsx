import { useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/**
 * Text field that saves on Enter or when it loses focus, not per keystroke.
 * Emptying it restores the default font.
 */
export function FontInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Show changes saved elsewhere (another window, a reset) while not typing.
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }

  const commit = () => {
    const next = draft.trim() || DEFAULT_SETTINGS.editor.font_family;
    setDraft(next);
    if (next !== value) onCommit(next);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      spellCheck={false}
      className="h-7 w-56 rounded-md border bg-background px-2 font-mono text-[12px]"
    />
  );
}
