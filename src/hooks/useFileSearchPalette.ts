import { useCallback, useEffect, useState } from "react";

/** The file search palette's open state. ⌘P (Ctrl+P elsewhere) opens it for the shown folder. */
export function useFileSearchPalette(folder: string | null) {
  const [state, setState] = useState({ open: false, opening: 0 });

  const openWithCurrentFolder = useCallback(() => {
    if (!folder) return;
    setState((s) => ({ open: true, opening: s.opening + 1 }));
  }, [folder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.shiftKey ||
        e.altKey ||
        e.key.toLowerCase() !== "p"
      ) {
        return;
      }
      if (!folder) return;
      e.preventDefault();
      setState((s) => ({ open: true, opening: s.opening + 1 }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [folder]);

  return {
    ...state,
    openWithCurrentFolder,
    setOpen: useCallback(
      (open: boolean) => setState((s) => ({ ...s, open })),
      [],
    ),
  };
}
