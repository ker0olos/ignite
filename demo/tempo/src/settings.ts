import { applyTheme, type Theme } from "./theme";
import { setDurations } from "./timer";

export type Settings = {
  focusMinutes: number;
  breakMinutes: number;
  sound: boolean;
  theme: Theme;
};

const DEFAULTS: Settings = {
  focusMinutes: 25,
  breakMinutes: 5,
  sound: true,
  theme: "system",
};

const KEY = "tempo.settings";

/** Settings saved in this browser, or the defaults. */
export function loadSettings(): Settings {
  const saved = localStorage.getItem(KEY);
  return { ...DEFAULTS, ...(saved ? JSON.parse(saved) : {}) };
}

/** Saves the settings and puts them into effect. */
export function applySettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  setDurations(settings.focusMinutes, settings.breakMinutes);
  applyTheme(settings.theme);
}
