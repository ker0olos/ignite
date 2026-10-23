import type { ITheme } from "@xterm/xterm";
import { ANSI } from "./themePalette";

const TOKENS = {
  background: "--background",
  foreground: "--foreground",
  cursor: "--foreground",
  cursorAccent: "--background",
  brightBlack: "--muted-foreground",
  selectionBackground: "--accent",
} as const;

// VS Code's terminal defaults; xterm's own (Tango) are dimmer.
const DEFAULT_ANSI: Record<"light" | "dark", ITheme> = {
  dark: {
    black: "#000000",
    red: "#cd3131",
    green: "#0dbc79",
    yellow: "#e5e510",
    blue: "#2472c8",
    magenta: "#bc3fbc",
    cyan: "#11a8cd",
    white: "#e5e5e5",
    brightRed: "#f14c4c",
    brightGreen: "#23d18b",
    brightYellow: "#f5f543",
    brightBlue: "#3b8eea",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#e5e5e5",
  },
  light: {
    black: "#000000",
    red: "#cd3131",
    green: "#107c10",
    yellow: "#949800",
    blue: "#0451a5",
    magenta: "#bc05bc",
    cyan: "#0598bc",
    white: "#555555",
    brightRed: "#cd3131",
    brightGreen: "#14ce14",
    brightYellow: "#b5ba00",
    brightBlue: "#0451a5",
    brightMagenta: "#bc05bc",
    brightCyan: "#0598bc",
    brightWhite: "#a5a5a5",
  },
};

/**
 * Maps each theme slot to its CSS token's value run through `resolve`, and
 * each ANSI color the theme sets (`--theme-<color>-<kind>`) to its own,
 * else VS Code's default.
 */
export function themeFromTokens(
  read: (token: string) => string,
  resolve: (color: string) => string,
  kind: "light" | "dark",
): ITheme {
  const theme: Record<string, string> = {
    ...(DEFAULT_ANSI[kind] as Record<string, string>),
    ...Object.fromEntries(
      Object.entries(TOKENS).map(([slot, token]) => [
        slot,
        resolve(read(token)),
      ]),
    ),
  };
  for (const color of ANSI) {
    const value = read(`--theme-${color}-${kind}`);
    if (value) theme[color] = resolve(value);
  }
  return theme;
}

function canvasColor(color: string): string {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return color;
  ctx.canvas.width = ctx.canvas.height = 1;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** xterm's theme from the app's shadcn tokens and code theme, resolved to rgb. */
export function terminalTheme(): ITheme {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return themeFromTokens(
    (t) => style.getPropertyValue(t).trim(),
    canvasColor,
    root.classList.contains("dark") ? "dark" : "light",
  );
}
