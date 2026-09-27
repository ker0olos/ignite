import { describe, expect, it } from "vitest";
import { memoryDescription, platformName, timeAgo } from "./memory";
import { APP_NAME } from "./app";

describe("memoryDescription", () => {
  it("explains why cmem can't run", () => {
    expect(memoryDescription(undefined, true, true)).toMatch(/Checking/);
    expect(memoryDescription("not-installed", true, true)).toMatch(/Install/);
    expect(memoryDescription("stopped", true, true)).toMatch(/isn't running/);
    expect(memoryDescription("excluded", true, true)).toMatch(/excluded/);
  });

  it("says what it does while running", () => {
    expect(memoryDescription("running", false, true)).toMatch(/^Off/);
    expect(memoryDescription("running", true, true)).toMatch(/this folder/);
    expect(memoryDescription("running", true, false)).toMatch(/each folder/);
  });
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
