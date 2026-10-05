import { expect, it } from "vitest";
import { themeFromTokens } from "./terminalTheme";

it("resolves each token through the resolver", () => {
  const theme = themeFromTokens(
    (t) => (t.startsWith("--theme-") ? "" : `oklch(${t})`),
    (c) => `rgb(${c})`,
    "dark",
  );
  expect(theme.background).toBe("rgb(oklch(--background))");
  expect(theme.cursor).toBe("rgb(oklch(--foreground))");
  expect(theme.cursorAccent).toBe("rgb(oklch(--background))");
  expect(theme.brightBlack).toBe("rgb(oklch(--muted-foreground))");
  expect(theme.selectionBackground).toBe("rgb(oklch(--accent))");
});

it("takes the ANSI colors the theme sets for its kind", () => {
  const vars: Record<string, string> = {
    "--theme-blue-dark": "#58a6ff",
    "--theme-blue-light": "#0969da",
  };
  const theme = themeFromTokens(
    (t) => vars[t] ?? "",
    (c) => c,
    "dark",
  );
  expect(theme.blue).toBe("#58a6ff");
  expect(theme.red).toBeUndefined();
});
