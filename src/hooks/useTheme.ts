import { useEffect, useState } from "react";
import { onStoreChange, store } from "@/lib/store";

export type Theme = "system" | "light" | "dark";

/** Persisted theme, synced across windows, applied as the `dark` class on <html>. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    store
      .then((s) => s.get<Theme>("theme"))
      .then((saved) => saved && setThemeState(saved));
    const unlisten = onStoreChange((key, value) => {
      if (key === "theme")
        setThemeState((value as Theme | undefined) ?? "system");
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    store.then((s) => s.set("theme", next));
  }

  return [theme, setTheme] as const;
}
