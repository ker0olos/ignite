import { useCallback, useEffect, useState } from "react";

/**
 * The command center's open state. ⌘K (Ctrl+K elsewhere) opens it anywhere,
 * or closes it; each opening starts afresh, from `query` when given.
 */
export function useCommandCenter() {
  const [state, setState] = useState({ open: false, query: "", opening: 0 });

  const openWith = useCallback(
    (query = "") =>
      setState((s) => ({ open: true, query, opening: s.opening + 1 })),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setState((s) =>
        s.open
          ? { ...s, open: false }
          : { open: true, query: "", opening: s.opening + 1 },
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    ...state,
    openWith,
    setOpen: useCallback(
      (open: boolean) => setState((s) => ({ ...s, open })),
      [],
    ),
  };
}
