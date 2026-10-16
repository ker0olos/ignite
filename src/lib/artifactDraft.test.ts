import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DRAFT_MESSAGE, DRAFT_SHELL } from "./artifactDraft";

// Run here as the frame runs them (jsdom's `parent` is the window itself).
function post(html: string, source: Window | null = window) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: DRAFT_MESSAGE, html },
      source,
    }),
  );
}

describe("the draft frame's receiver", () => {
  beforeAll(() => {
    // One script, since the receiver calls the backdrop script's function.
    const scripts = new DOMParser()
      .parseFromString(DRAFT_SHELL, "text/html")
      .querySelectorAll("script");
    new Function([...scripts].map((s) => s.textContent).join("\n"))();
  });

  beforeEach(() => {
    document.documentElement
      .getAttributeNames()
      .forEach((name) => document.documentElement.removeAttribute(name));
    document.head.innerHTML = "<meta name='own'>";
    document.body.innerHTML = "";
  });

  it("puts the draft's styles, <html> attributes and body in place, without scripts or handlers", () => {
    post(
      "<html data-theme='dark'><head><style>p{}</style><script>x()</script></head><body class='b' onload='y()'><p>hi</p><img src=x onerror='z()'><script>y()</script></body></html>",
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.head.innerHTML).toBe(
      '<style id="ignite-backdrop">html{background:#fff}</style><meta name="own"><style data-draft="">p{}</style>',
    );
    expect(document.body.outerHTML).toBe(
      '<body class="b"><p>hi</p><img src="x"></body>',
    );
  });

  it("keeps the head's nodes when they didn't change, and swaps them when they did", () => {
    const draftStyles = () => document.head.querySelectorAll("[data-draft]");
    post("<style>p{}</style><p>a</p>");
    const style = draftStyles()[0];
    post("<style>p{}</style><p>ab</p>");
    expect(draftStyles()[0]).toBe(style);
    post("<style>q{}</style><p>abc</p>");
    expect(draftStyles()).toHaveLength(1);
    expect(draftStyles()[0].textContent).toBe("q{}");
  });

  it("puts white behind a draft only while it has no background of its own", () => {
    const backdrop = () => document.getElementById("ignite-backdrop");
    post("<p>a</p>");
    expect(backdrop()).not.toBeNull();
    post("<body style='background-color: black'><p>a</p></body>");
    expect(backdrop()).toBeNull();
  });

  it("drops <html> attributes a later draft no longer has", () => {
    post("<html class='da'><p>a</p>");
    post("<html lang='en'><p>a</p>");
    expect(document.documentElement.getAttributeNames()).toEqual(["lang"]);
  });

  it("ignores messages from anywhere but the app", () => {
    post("<p>from elsewhere</p>", null);
    expect(document.body.innerHTML).toBe("");
  });
});
