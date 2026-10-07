import { useEffect, useState } from "react";
import { codeThemesFor, type ThemeKind } from "@/lib/codeThemes";
import { DEMO_FOLDER } from "@/lib/demo";
import { importTheme, themeKind } from "@/lib/codeThemeLoad";
import { applyPalettes, loadPalettes } from "@/lib/themePalette";
import { setGlass, setGlassTheme } from "@/lib/window";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  onSettingsChange,
  saveSettings,
  type Settings,
} from "@/lib/settings";

/**
 * User settings from ~/.<APP_NAME>/settings.toml, synced across windows.
 * Also applies the theme as the `dark` class on <html>, its accent colors,
 * and Liquid Glass. Demo mode starts from
 * the defaults and never reads or saves the user's.
 */
export function useSettings(demo = !!DEMO_FOLDER) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(demo);

  useEffect(() => {
    if (demo) return;
    loadSettings().then(async (loaded) => {
      setSettings(loaded);
      setLoaded(true);
      // A theme picked straight from an editor (before themes were copied in)
      // is copied now, so uninstalling that editor can't break it later.
      const theme = await importTheme(loaded.theme);
      if (theme !== loaded.theme) saveSettings({ ...loaded, theme });
    });
    const unlisten = onSettingsChange(setSettings);
    return () => {
      unlisten.then((f) => f());
    };
  }, [demo]);

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
      setGlassTheme(k).catch(() => {});
    });
    loadPalettes(codeThemesFor(theme)).then((palettes) => {
      if (!cancelled) applyPalettes(palettes);
    });
    media.addEventListener("change", apply);
    return () => {
      cancelled = true;
      media.removeEventListener("change", apply);
    };
  }, [theme]);

  // Waits for the user's settings, so glass they turned off never flashes on.
  // In a browser (remote access) there is no window to glaze; the page stays opaque.
  const glass = settings.mac.liquid_glass;
  useEffect(() => {
    if (loaded) setGlass(glass).catch(() => {});
  }, [loaded, glass]);

  /** Shows the change now; resolves once it's saved. */
  function updateSettings(next: Settings) {
    setSettings(next);
    return demo ? Promise.resolve() : saveSettings(next);
  }

  return [settings, updateSettings] as const;
}
