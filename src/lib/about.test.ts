import { describe, expect, it } from "vitest";
import {
  aboutPanel,
  updateButton,
  updateDescription,
  versionLine,
} from "./about";

const VERSION = {
  sha: "a1b2c3d4e5f6",
  date: "2026-09-25T10:00:00+03:00",
  subject: "feat: questions",
};
const NOW = Date.parse("2026-09-28T12:00:00+03:00");

describe("versionLine", () => {
  it("shows the short sha, the day and how long ago", () => {
    expect(versionLine(VERSION, NOW)).toBe(
      "a1b2c3d · Sep 25, 2026 · 3 days ago",
    );
  });
});

describe("aboutPanel", () => {
  it("puts the sha, day and age on the version line, the message below", () => {
    expect(aboutPanel(VERSION, NOW)).toEqual({
      version: "a1b2c3d",
      shortVersion: "Sep 25, 2026 · 3 days ago",
      credits: "feat: questions",
    });
  });

  it("keeps the bundle's version until the commit is known", () => {
    expect(aboutPanel(null)).toBeNull();
  });
});

describe("updateDescription", () => {
  it("explains the button before a check, then gets out of the way", () => {
    expect(updateDescription("idle")).toMatch(/latest version/);
    expect(updateDescription("checking")).toBeUndefined();
    expect(updateDescription("up-to-date")).toBeUndefined();
    expect(updateDescription("updated")).toBeUndefined();
  });

  it("shows git's reason when a check failed", () => {
    expect(updateDescription({ error: "Not possible to fast-forward" })).toBe(
      "Not possible to fast-forward",
    );
  });
});

describe("updateButton", () => {
  it("says where the check is, spinning while it works", () => {
    expect(updateButton("idle")).toEqual({
      label: "Check for updates",
      spinning: false,
      disabled: false,
    });
    expect(updateButton("checking")).toEqual({
      label: "Checking for updates",
      spinning: true,
      disabled: true,
    });
    expect(updateButton("up-to-date")).toEqual({
      label: "Up to date",
      spinning: false,
      disabled: true,
    });
    expect(updateButton("updated")).toEqual({
      label: "Reloading",
      spinning: true,
      disabled: true,
    });
    expect(updateButton({ error: "x" })).toMatchObject({
      label: "Check for updates",
      disabled: false,
    });
  });
});
