import { useEffect, useState } from "react";
import { themeKind, type ThemeKind } from "@/lib/codeThemes";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  onSettingsChange,
  saveSettings,
  type Settings,
} from "@/lib/settings";

/**
 * User settings from ~/.<APP_NAME>/settings.toml, synced across windows.
 * Also applies the theme as the `dark` class on <html>.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
    const unlisten = onSettingsChange(setSettings);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // The theme decides light or dark; "system" (or an unknown theme) follows macOS.
  const { theme } = settings;
  useEffect(() => {
    let cancelled = false;
    let kind: ThemeKind | null = null;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        kind ? kind === "dark" : media.matches,
      );
    apply();
    themeKind(theme).then((k) => {
      if (cancelled) return;
      kind = k;
      apply();
    });
    media.addEventListener("change", apply);
    return () => {
      cancelled = true;
      media.removeEventListener("change", apply);
    };
  }, [theme]);

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  return [settings, updateSettings] as const;
}
