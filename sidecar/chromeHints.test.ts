// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { Cdp } from "./chrome.ts";
import { pageOf, signInHint } from "./chromeHints.ts";

const evaluate = vi.hoisted(() => vi.fn());
vi.mock("./chromePage.ts", () => ({ evaluate }));

it("tells the agent to use the user's Chrome on a sign-in page in the app's own, outside a task", () => {
  const page = (title: string, url = "http://a.dev/") => ({ title, url });
  for (const p of [
    page("Sign in | MOTR", "http://127.0.0.1:5190/"),
    page("Log-in"),
    page("MOTR", "https://a.dev/login?next=/"),
    page("MOTR", "https://a.dev/auth/sign-in"),
  ])
    expect(signInHint(p, false, false)).toContain("user_chrome: true");
  expect(signInHint(page("Sign in"), true, false)).toBe("");
  expect(signInHint(page("Sign in"), false, true)).toBe("");
  for (const p of [
    page("Catalog Inventory"),
    page("Blog: login tips"),
    page("Docs", "https://a.dev/docs/auth/overview"),
    page("Docs", "https://a.dev/blog/login-tips"),
  ])
    expect(signInHint(p, false, false)).toBe("");
});

it("reads the page's title and URL, or nothing when it can't", async () => {
  const cdp = {} as Cdp;
  evaluate.mockResolvedValueOnce({ title: "Sign in", url: "http://a.dev/" });
  expect(await pageOf(cdp, "s")).toEqual({
    title: "Sign in",
    url: "http://a.dev/",
  });
  evaluate.mockRejectedValueOnce(new Error("gone"));
  expect(await pageOf(cdp, "s")).toEqual({ title: "", url: "" });
});
