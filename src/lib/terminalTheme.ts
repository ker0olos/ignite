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

/**
 * Maps each theme slot to its CSS token's value run through `resolve`, and
 * each ANSI color the theme sets (`--theme-<color>-<kind>`) to its own.
 */
export function themeFromTokens(
  read: (token: string) => string,
  resolve: (color: string) => string,
  kind: "light" | "dark",
): ITheme {
  const theme: Record<string, string> = Object.fromEntries(
    Object.entries(TOKENS).map(([slot, token]) => [slot, resolve(read(token))]),
  );
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
