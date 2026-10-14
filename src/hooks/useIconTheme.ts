import { useEffect, useSyncExternalStore } from "react";
import { loadIconTheme, MINIMAL_ICONS, type IconTheme } from "@/lib/iconThemes";

type Snapshot = { theme: IconTheme | null; light: boolean };

const isLight = () => !document.documentElement.classList.contains("dark");
let snapshot: Snapshot = { theme: null, light: isLight() };
const listeners = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

new MutationObserver(() => {
  if (isLight() !== snapshot.light) set({ light: isLight() });
}).observe(document.documentElement, { attributeFilter: ["class"] });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The icon theme files are drawn with (null: the app's own glyphs), and whether the app is light. */
export function useIconTheme() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Loads the `icon_theme` setting for every file icon; one that's gone falls back to the app's own. */
export function useApplyIconTheme(id: string) {
  useEffect(() => {
    let cancelled = false;
    const load =
      id === MINIMAL_ICONS ? Promise.resolve(null) : loadIconTheme(id);
    load
      .catch((e) => {
        console.warn(`icon theme ${id} failed to load`, e);
        return null;
      })
      .then((theme) => {
        if (!cancelled) set({ theme });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
}
