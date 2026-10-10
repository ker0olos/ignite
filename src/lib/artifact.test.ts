import { describe, expect, it } from "vitest";
import { artifactPages, embeddedPage, frameHeight } from "./artifact";

describe("artifactPages", () => {
  it("reads each page as HTML or markdown, labelling untitled ones", () => {
    expect(
      artifactPages({
        title: "Designs",
        pages: [
          { title: "A", html: "<p>a</p>", libraries: ["daisyui", "react"] },
          { markdown: "# b" },
          { title: "Empty" },
          "junk",
        ],
      }),
    ).toEqual([
      { title: "A", html: "<p>a</p>", libraries: ["daisyui"] },
      { title: "Page 2", markdown: "# b" },
    ]);
  });

  it("reads a show_html call as one HTML page", () => {
    expect(artifactPages({ title: "Old", html: "<p>x</p>" })).toEqual([
      { title: "Old", html: "<p>x</p>", libraries: [] },
    ]);
  });

  it("has no pages when a show_html call has no html", () => {
    expect(artifactPages({ title: "Old", markdown: "# x" })).toEqual([]);
  });
});

describe("embeddedPage", () => {
  it("puts the policy right after the doctype", () => {
    const page = embeddedPage("<!DOCTYPE html><html><body>hi</body></html>");
    expect(page).toMatch(
      /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src 'none';/,
    );
    expect(page).toContain("<html><body>hi</body></html>");
  });

  it("puts it first when there's no doctype", () => {
    expect(embeddedPage("<p>hi</p>")).toMatch(
      /^<meta [^>]+><script>.*<p>hi<\/p>$/s,
    );
  });

  it("adds the libraries' CSS before the page's own", () => {
    expect(embeddedPage("<p>hi</p>", ".x{}")).toMatch(
      /<\/script><style>\.x\{\}<\/style><p>hi<\/p>$/,
    );
  });

  it("blocks the page's own network requests", () => {
    const doc = new DOMParser().parseFromString(
      embeddedPage("<!doctype html><img src='https://example.com/x'>"),
      "text/html",
    );
    expect(doc.compatMode).toBe("CSS1Compat");
    expect(
      doc.head.querySelector("meta[http-equiv]")?.getAttribute("content"),
    ).toContain("default-src 'none'");
  });

  it("lets pages load Google Fonts and nothing else from the network", () => {
    const policy = new DOMParser()
      .parseFromString(embeddedPage("<p>hi</p>"), "text/html")
      .head.querySelector("meta[http-equiv]")
      ?.getAttribute("content");
    const hosts = policy?.match(/https:\/\/[\w.]+/g) ?? [];
    expect(new Set(hosts)).toEqual(
      new Set(["https://fonts.googleapis.com", "https://fonts.gstatic.com"]),
    );
  });
});

describe("frameHeight", () => {
  it("keeps the agent's height within bounds", () => {
    expect(frameHeight(300)).toBe(300);
    expect(frameHeight(10)).toBe(80);
    expect(frameHeight(100000)).toBe(1200);
  });

  it("falls back to 360 for missing or invalid heights", () => {
    expect(frameHeight(undefined)).toBe(360);
    expect(frameHeight(-5)).toBe(360);
    expect(frameHeight("tall")).toBe(360);
  });
});
