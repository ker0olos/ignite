import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  onSettingsChange,
  saveSettings,
  type Settings,
} from "@/lib/settings";

/**
 * User settings from ~/.untitledharness/settings.toml, synced across windows.
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

  const { theme } = settings;
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

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  return [settings, updateSettings] as const;
}
