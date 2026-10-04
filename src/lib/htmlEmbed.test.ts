import { describe, expect, it } from "vitest";
import { embeddedPage, frameHeight } from "./htmlEmbed";

describe("embeddedPage", () => {
  it("puts the policy right after the doctype", () => {
    const page = embeddedPage("<!DOCTYPE html><html><body>hi</body></html>");
    expect(page).toMatch(
      /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src 'none';/,
    );
    expect(page).toContain("<html><body>hi</body></html>");
  });

  it("puts it first when there's no doctype", () => {
    expect(embeddedPage("<p>hi</p>")).toMatch(/^<meta [^>]+><p>hi<\/p>$/);
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
