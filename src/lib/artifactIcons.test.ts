import { describe, expect, it } from "vitest";
import { iconCss, usesIcons } from "./artifactIcons";

describe("iconCss", () => {
  it("builds the Lucide and Simple Icons classes a page uses", async () => {
    const css = await iconCss(
      `<span class="i-lucide-house size-6"></span><i class="i-simple-icons-github"></i>`,
    );
    expect(css).toMatch(/^@layer components\{/);
    expect(css).toContain(".i-lucide-house{");
    expect(css).toContain(".i-simple-icons-github{");
    expect(css).toContain('mask:url("data:image/svg+xml,%3Csvg');
  });

  it("leaves out names neither set has", async () => {
    expect(await iconCss(`<i class="i-lucide-no-such-icon"></i>`)).toBe(
      "@layer components{}",
    );
  });

  it("tells pages with icons from pages without, call after call", () => {
    expect(usesIcons(`<i class="i-lucide-house">`)).toBe(true);
    expect(usesIcons(`<i class="i-simple-icons-x">`)).toBe(true);
    expect(usesIcons(`<i class="i-fa-home">`)).toBe(false);
  });

  it("is empty for a page with no icon classes", async () => {
    expect(await iconCss(`<i class="i-fa-home">`)).toBe("");
  });
});
