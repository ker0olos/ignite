import { expect, it } from "vitest";
import { themeFromTokens } from "./terminalTheme";

it("resolves each token through the resolver", () => {
  const theme = themeFromTokens(
    (t) => `oklch(${t})`,
    (c) => `rgb(${c})`,
  );
  expect(theme.background).toBe("rgb(oklch(--background))");
  expect(theme.cursor).toBe("rgb(oklch(--foreground))");
  expect(theme.cursorAccent).toBe("rgb(oklch(--background))");
  expect(theme.brightBlack).toBe("rgb(oklch(--muted-foreground))");
  expect(theme.selectionBackground).toBe("rgb(oklch(--accent))");
});
