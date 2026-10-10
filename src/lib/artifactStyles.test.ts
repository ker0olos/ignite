import { describe, expect, it } from "vitest";
import { artifactLibraries, libraryCss } from "./artifactStyles";

describe("artifactLibraries", () => {
  it("keeps only the libraries the app ships", () => {
    expect(artifactLibraries({ libraries: ["daisyui", "react", 3] })).toEqual([
      "daisyui",
    ]);
    expect(artifactLibraries({ libraries: "daisyui" })).toEqual([]);
    expect(artifactLibraries({})).toEqual([]);
  });
});

describe("libraryCss", () => {
  const page = `<button class="btn btn-primary flex">Go</button>
<script>el.classList.add("badge")</script>`;

  it("builds daisyUI components and Tailwind utilities the page uses", async () => {
    const css = await libraryCss(page, ["daisyui"]);
    expect(css).toContain(".btn-primary");
    expect(css).toContain(".flex");
    // Added by the page's script, not in its markup.
    expect(css).toContain(".badge");
    expect(css).not.toContain(".card-title");
  });

  it("builds Tailwind alone without daisyUI", async () => {
    const css = await libraryCss(page, ["tailwind"]);
    expect(css).toContain(".flex");
    expect(css).not.toContain(".btn-primary");
  });

  it("builds each page alone, not with classes from pages before it", async () => {
    await libraryCss(`<p class="grid">`, ["tailwind"]);
    expect(await libraryCss(`<p class="flex">`, ["tailwind"])).not.toContain(
      ".grid",
    );
  });

  it("keeps variants with = and skips data: URLs", async () => {
    const css = await libraryCss(
      `<p class="data-[state=open]:block"><img src="data:image/png;base64,flex">`,
      ["tailwind"],
    );
    expect(css).toMatch(/state\\?=open/);
    expect(css).not.toContain(".flex");
  });

  it("is empty when the page asked for none", async () => {
    expect(await libraryCss(page, [])).toBe("");
  });
});
