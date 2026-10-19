import { expect, it } from "vitest";
import {
  memoryDescription,
  platformName,
  kindFilters,
  timeAgo,
  totalOf,
} from "./memory";
import { APP_NAME } from "./app";

it("says what memory does, or that it's off", () => {
  expect(memoryDescription(false, true)).toMatch(/^Off/);
  expect(memoryDescription(true, true)).toMatch(/this folder/);
  expect(memoryDescription(true, false)).toMatch(/each folder/);
});

it("filters by type, most kept first, after All", () => {
  expect(kindFilters({ bugfix: 2, discovery: 5, mine: 1, change: 0 })).toEqual([
    { kind: null, label: "All", count: 8 },
    { kind: "discovery", label: "Discoveries", count: 5 },
    { kind: "bugfix", label: "Fixes", count: 2 },
    { kind: "mine", label: "mine", count: 1 },
  ]);
  expect(kindFilters({})).toEqual([{ kind: null, label: "All", count: 0 }]);
  expect(totalOf({ bugfix: 2, change: 3 })).toBe(5);
});

it("names the tool that recorded an observation", () => {
  expect(platformName("claude")).toBe("Claude Code");
  expect(platformName(APP_NAME)).toBe("this app");
  expect(platformName("gemini")).toBe("gemini");
});

it("says how long ago something happened", () => {
  const now = 10 * 86_400_000;
  expect(timeAgo(now - 5_000, now)).toBe("just now");
  expect(timeAgo(now - 5 * 60_000, now)).toBe("5 minutes ago");
  expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 hours ago");
  expect(timeAgo(now - 86_400_000, now)).toBe("yesterday");
});
