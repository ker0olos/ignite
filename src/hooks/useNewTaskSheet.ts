import { useEffect, useState } from "react";

/** The new-task sheet's open state; ⌘N (Ctrl+N elsewhere) opens it while the Tasks view shows. */
export function useNewTaskSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      if (e.key.toLowerCase() !== "n") return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return [open, setOpen] as const;
}
