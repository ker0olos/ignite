import type { ITheme } from "@xterm/xterm";

const TOKENS = {
  background: "--background",
  foreground: "--foreground",
  cursor: "--foreground",
  cursorAccent: "--background",
  brightBlack: "--muted-foreground",
  selectionBackground: "--accent",
} as const;

/** Maps each theme slot to its CSS token's value run through `resolve`. */
export function themeFromTokens(
  read: (token: string) => string,
  resolve: (color: string) => string,
): ITheme {
  return Object.fromEntries(
    Object.entries(TOKENS).map(([slot, token]) => [slot, resolve(read(token))]),
  );
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

/** xterm's theme from the app's shadcn tokens, resolved from oklch to rgb. */
export function terminalTheme(): ITheme {
  const style = getComputedStyle(document.documentElement);
  return themeFromTokens((t) => style.getPropertyValue(t).trim(), canvasColor);
}
