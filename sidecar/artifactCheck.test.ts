import { describe, expect, it, vi } from "vitest";
import { checkedPage, pageErrors } from "./artifactCheck.ts";
import { chrome } from "./chrome.ts";

vi.mock("./chrome.ts", () => ({
  chrome: vi.fn(async () => {
    throw new Error("Chrome isn't installed");
  }),
  hiddenContexts: new Set(),
}));
vi.mock("./chromeSettings.ts", () => ({
  chromeToolsOn: vi.fn(async () => (chromeOn ? ["chrome_eval"] : [])),
}));
let chromeOn = true;

describe("checkedPage", () => {
  it("puts the policy and error log after the doctype, on its first line", () => {
    const page = checkedPage("<!doctype html>\n<p>a</p>");
    expect(page).toMatch(
      /^<!doctype html><meta http-equiv="Content-Security-Policy"/,
    );
    expect(page).toContain("__artifactErrors");
    expect(page.split("\n")).toHaveLength(2);
  });

  it("puts them first in a page with no doctype", () => {
    expect(checkedPage("<p>a</p>")).toMatch(/^<meta .*<\/script><p>a<\/p>$/);
  });
});

describe("pageErrors", () => {
  it("checks nothing, starting no Chrome, when Chrome is turned off", async () => {
    chromeOn = false;
    expect(await pageErrors("<p>a</p>")).toEqual([]);
    expect(chrome).not.toHaveBeenCalled();
    chromeOn = true;
  });

  it("passes the page when Chrome can't check it", async () => {
    expect(await pageErrors("<p>a</p>")).toEqual([]);
    expect(chrome).toHaveBeenCalled();
  });
});
