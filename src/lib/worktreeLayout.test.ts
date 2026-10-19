import { beforeEach, expect, it } from "vitest";
import {
  cacheLayout,
  cachedLayout,
  conversationRoot,
  paneRoot,
} from "./worktreeLayout";

beforeEach(() => localStorage.clear());

const layout = { base: "/wt/app-1234", prefix: "" };

it("is the folder before a first message, and while the folder's conversation isn't known yet", () => {
  expect(conversationRoot("/app", null, null, layout)).toBe("/app");
  expect(conversationRoot("/app", undefined, null, layout)).toBe("/app");
  expect(conversationRoot(null, "s1", "/wt/x", layout)).toBeNull();
});

it("is a conversation's worktree: from its reply, else from the folder's layout", () => {
  expect(conversationRoot("/app", "s1", "/somewhere", layout)).toBe(
    "/somewhere",
  );
  expect(conversationRoot("/app", "s1", null, layout)).toBe("/wt/app-1234/s1");
  expect(
    conversationRoot("/app/web", "s1", null, { ...layout, prefix: "web" }),
  ).toBe("/wt/app-1234/s1/web");
  expect(
    conversationRoot("C:\\app", "s1", null, { base: "C:\\wt\\a", prefix: "" }),
  ).toBe("C:\\wt\\a\\s1");
});

it("is the folder when its conversations share it, and unknown before its layout is", () => {
  expect(conversationRoot("/app", "s1", null, null)).toBe("/app");
  expect(conversationRoot("/app", "s1", null, undefined)).toBeNull();
});

it("remembers each folder's layout", () => {
  expect(cachedLayout("/app")).toBeUndefined();
  cacheLayout("/app", layout);
  cacheLayout("/plain", null);
  expect(cachedLayout("/app")).toEqual(layout);
  expect(cachedLayout("/plain")).toBeNull();
});

it("resolves a pane's paths in its worktree, the shown one's root while it opens, else its folder", () => {
  const pane = { session: "s1", folder: "/app", workdir: null };
  expect(paneRoot({ ...pane, workdir: "/wt/s1" }, "s1", "/x")).toBe("/wt/s1");
  expect(paneRoot(pane, "s1", "/wt/s1")).toBe("/wt/s1");
  expect(paneRoot(pane, "s2", "/wt/s2")).toBe("/app");
  expect(paneRoot(pane, "s1", null)).toBe("/app");
});
