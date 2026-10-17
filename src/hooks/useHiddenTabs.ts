import { useCallback, useState } from "react";

/** The IDE layouts' closed conversation tabs: the strip hides them, showing the conversation reopens one. */
export function useHiddenTabs() {
  const [hidden, setHidden] = useState<string[]>([]);
  return {
    hidden,
    hide: useCallback(
      (session: string) => setHidden((h) => [...h, session]),
      [],
    ),
    reopen: useCallback(
      (session: string) => setHidden((h) => h.filter((s) => s !== session)),
      [],
    ),
  };
}
