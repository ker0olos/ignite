import { useEffect } from "react";
import { nextTextSize, type Settings } from "@/lib/settings";

/** ⌘/Ctrl +, - and 0 resize message text, applied as the `--message-text` CSS variable. */
export function useTextSize(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  const size = settings.conversation.text_size;

  useEffect(() => {
    document.documentElement.style.setProperty("--message-text", `${size}px`);
  }, [size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const next = nextTextSize(size, e.key);
      if (next === null) return;
      e.preventDefault();
      if (next === size) return;
      void save({
        ...settings,
        conversation: { ...settings.conversation, text_size: next },
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings, save, size]);
}
