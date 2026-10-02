import { useCallback, useEffect, useState } from "react";

const FILES_QUERY = "@files ";

/**
 * The command center's open state. ⌘K (Ctrl+K elsewhere) opens it anywhere,
 * or closes it; ⌘P opens it on `@files` with no preview. Each opening starts
 * afresh, from `query` when given.
 */
export function useCommandCenter() {
  const [state, setState] = useState({
    open: false,
    query: "",
    opening: 0,
    preview: true,
  });

  const openWith = useCallback(
    (query = "") =>
      setState((s) => ({
        open: true,
        query,
        opening: s.opening + 1,
        preview: true,
      })),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "p") return;
      e.preventDefault();
      const preview = key === "k";
      setState((s) =>
        s.open && s.preview === preview
          ? { ...s, open: false }
          : {
              open: true,
              query: preview ? "" : FILES_QUERY,
              opening: s.opening + 1,
              preview,
            },
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
