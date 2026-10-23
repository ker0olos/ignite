import { useEffect, useLayoutEffect, useRef } from "react";
import { modKey } from "@/lib/approvalKeys";

/** The sidebar's conversation rows, top to bottom. */
type Row = { cwd: string; session: string };

/** ⌘1…⌘9 (Ctrl off macOS) show the first nine of `rows`; returns each numbered row's digit, by conversation. */
export function useConversationShortcuts(
  rows: Row[],
  show: (cwd: string, session: string) => void,
) {
  const numbered = rows.slice(0, 9);
  const latest = useRef({ numbered, show });
  useLayoutEffect(() => {
    latest.current = { numbered, show };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!modKey(e) || e.altKey || e.shiftKey) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      // By key, not character, so every layout's digit row works.
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1];
      const row = digit && latest.current.numbered[Number(digit) - 1];
      if (!row) return;
      e.preventDefault();
      latest.current.show(row.cwd, row.session);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return new Map(numbered.map((r, i) => [r.session, i + 1]));
}
