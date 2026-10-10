import { afterEach, describe, expect, it, vi } from "vitest";
import { googleFontCss } from "./artifactFonts";

const SHEET = "https://fonts.googleapis.com/css2?family=Inter&display=swap";
const FILE = "https://fonts.gstatic.com/s/inter/v1/a.woff2";

function serve(responses: Record<string, Response | undefined>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const response = responses[url];
      if (!response) throw new Error("offline");
      return response;
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("googleFontCss", () => {
  it("fetches each linked sheet once and inlines its font files", async () => {
    serve({
      [SHEET]: new Response(`@font-face{src:url(${FILE})}`),
      [FILE]: new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "font/woff2" },
      }),
    });
    const html = `<link href="${SHEET.replace("&", "&amp;")}"><link href="${SHEET}">`;
    expect(await googleFontCss(html)).toBe(
      "@font-face{src:url(data:font/woff2;base64,AQID)}",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("leaves out a sheet that fails to load", async () => {
    serve({});
    expect(await googleFontCss(`<link href="${SHEET}">`)).toBe("");
  });

  it("is empty for a page with no Google Fonts", async () => {
    serve({});
    expect(await googleFontCss(`<link href="https://example.com/a.css">`)).toBe(
      "",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
