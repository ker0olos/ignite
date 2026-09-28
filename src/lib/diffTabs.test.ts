import { describe, expect, it } from "vitest";
import {
  diffTabId,
  rangeLabel,
  readDiffTab,
  readGitReview,
  tabLabel,
} from "./diffTabs";

const tab = {
  repo: "/repo",
  range: "staged",
  path: "src/foo.ts",
  status: "M" as const,
};

describe("diffTabId / readDiffTab", () => {
  it("round-trips a diff tab", () => {
    expect(readDiffTab(diffTabId(tab))).toEqual(tab);
  });

  it("returns null for a plain file path", () => {
    expect(readDiffTab("/repo/src/foo.ts")).toBeNull();
  });

  it("returns null for malformed JSON after the prefix", () => {
    expect(readDiffTab("diff:{not json")).toBeNull();
  });

  it("returns null when a field is missing", () => {
    expect(readDiffTab(`diff:${JSON.stringify({ repo: "/repo" })}`)).toBeNull();
  });
});

describe("rangeLabel", () => {
  it("labels the working tree and staged ranges", () => {
    expect(rangeLabel("HEAD")).toBe("Working Tree");
    expect(rangeLabel("staged")).toBe("Staged");
  });

  it("shortens a single commit range", () => {
    expect(rangeLabel("abc1234567^!")).toBe("abc1234");
  });

  it("shortens a commit range pair, with .. or ...", () => {
    expect(rangeLabel("abc1234567..def8901234")).toBe("abc1234..def8901");
    expect(rangeLabel("abc1234567...def8901234")).toBe("abc1234..def8901");
  });
});

describe("tabLabel", () => {
  it("labels a plain file path relative to the folder", () => {
    expect(tabLabel("/repo/src/foo.ts", "/repo")).toEqual({
      name: "foo.ts",
      iconPath: "/repo/src/foo.ts",
      title: "src/foo.ts",
    });
  });

  it("labels a diff tab with its range and status", () => {
    expect(tabLabel(diffTabId(tab), "/repo")).toEqual({
      name: "foo.ts",
      detail: "Staged",
      iconPath: "src/foo.ts",
      title: "src/foo.ts",
      status: "M",
    });
  });
});

describe("readGitReview", () => {
  it("reads a commit review", () => {
    const review = {
      kind: "commit",
      repo: "/repo",
      range: "staged",
      files: [],
    };
    expect(readGitReview(review)).toEqual(review);
  });

  it("reads a push review", () => {
    const review = { kind: "push", repo: "/repo", range: "HEAD", files: [] };
    expect(readGitReview(review)).toEqual(review);
  });

  it("returns null for anything else", () => {
    expect(readGitReview(null)).toBeNull();
    expect(readGitReview({})).toBeNull();
    expect(readGitReview({ kind: "commit", repo: "/repo" })).toBeNull();
    expect(readGitReview("nope")).toBeNull();
  });
});
