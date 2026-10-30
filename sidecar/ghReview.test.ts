// @vitest-environment node
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validRange } from "../shared/git.ts";
import {
  editsPrText,
  prEditReview,
  prFileDiff,
  prReview,
  readPrCreate,
} from "./ghReview.ts";

const COMPARE = JSON.stringify({
  files: [
    { filename: "src/a.ts", status: "modified", additions: 3, deletions: 1 },
    { filename: "b.md", status: "added", additions: 2, deletions: 0 },
  ],
  commits: [
    { sha: "1111111aaaa", commit: { message: "first\n\nbody" } },
    { sha: "2222222bbbb", commit: { message: "second" } },
  ],
});
const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "diff --git a/b.md b/b.md",
  "@@ -0,0 +1 @@",
  "+hi",
].join("\n");

// A fake gh: the compare API as JSON, or as a diff when asked for one.
const FAKE_GH = `#!/bin/sh
case "$*" in
  *"application/vnd.github.diff"*) cat "$(dirname "$0")/diff.txt" ;;
  "api repos/o/r/compare/main...feat") cat "$(dirname "$0")/compare.json" ;;
  "pr view 7 -R o/r --json number,title,body") echo '{"number":7,"title":"Fix it","body":"old"}' ;;
  "pr view 8 --json number,title,body") echo "warning: update available" >&2; cat "$(dirname "$0")/pr8.json" ;;
  *) exit 1 ;;
esac
`;

let bin: string;
beforeEach(async () => {
  bin = await realpath(await mkdtemp(join(tmpdir(), "fake-gh-")));
  await writeFile(join(bin, "gh"), FAKE_GH);
  await chmod(join(bin, "gh"), 0o755);
  await writeFile(join(bin, "compare.json"), COMPARE);
  await writeFile(join(bin, "diff.txt"), DIFF);
  vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(bin, { recursive: true, force: true });
});

describe("readPrCreate", () => {
  it("reads options in both forms, and draft and fill flags", () => {
    expect(
      readPrCreate([
        "-t",
        "Fix",
        "--body=Why",
        "-B",
        "main",
        "--draft",
        "--fill",
      ]),
    ).toEqual({
      values: { title: "Fix", body: "Why", base: "main" },
      draft: true,
      fill: true,
    });
  });
});

describe("prReview", () => {
  it("shows the pull request with GitHub's commits and files", async () => {
    const args = [
      "pr",
      "create",
      "-R",
      "o/r",
      "-B",
      "main",
      "-H",
      "feat",
      "-t",
      "Fix it",
      "-b",
      "Because",
    ];
    expect(await prReview(args, bin)).toEqual({
      kind: "pr",
      repo: bin,
      range: "gh:o/r:main...feat",
      files: [
        { path: "src/a.ts", status: "M", added: 3, removed: 1 },
        { path: "b.md", status: "A", added: 2, removed: 0 },
      ],
      commits: [
        { hash: "2222222", subject: "second" },
        { hash: "1111111", subject: "first" },
      ],
      pr: {
        repo: "o/r",
        base: "main",
        head: "feat",
        title: "Fix it",
        body: "Because",
        draft: false,
      },
    });
  });

  it("shows no changes when the branches can't be found", async () => {
    const shown = await prReview(["pr", "create", "--fill"], bin);
    expect(shown.files).toEqual([]);
    expect(shown.pr?.title).toBe("From the commits");
  });
});

describe("editsPrText", () => {
  it("is a pr edit that sets the title or description", () => {
    expect(editsPrText(["pr", "edit", "7", "--body", "x"])).toBe(true);
    expect(editsPrText(["pr", "edit", "-F", "b.md"])).toBe(true);
    expect(editsPrText(["pr", "edit", "7", "--add-label", "bug"])).toBe(false);
    expect(editsPrText(["pr", "create", "-t", "x"])).toBe(false);
  });
});

describe("prEditReview", () => {
  it("diffs the pull request's title and description with the new ones", async () => {
    const args = [
      "pr",
      "edit",
      "--add-label",
      "x",
      "7",
      "-R",
      "o/r",
      "-b",
      "new",
    ];
    const shown = await prEditReview(args, bin);
    expect(shown?.edit?.pr).toBe("o/r#7");
    expect(shown?.edit?.diff).toMatch(/^@@ .*\n # Fix it\n \n-old\n\+new\n$/m);
  });

  it("finds the pull request after a flag that takes no value", async () => {
    const args = [
      "pr",
      "edit",
      "--remove-milestone",
      "7",
      "-R",
      "o/r",
      "-b",
      "x",
    ];
    expect((await prEditReview(args, bin))?.edit?.pr).toBe("o/r#7");
  });

  it("reads gh's JSON past its warnings, and a body's CRLF as LF", async () => {
    const pr = { number: 8, title: "T", body: "a\r\nb" };
    await writeFile(join(bin, "pr8.json"), JSON.stringify(pr));
    const shown = await prEditReview(["pr", "edit", "8", "-b", "a\nc"], bin);
    expect(shown?.edit?.diff).toMatch(/\n a\n-b\n\+c\n$/);
  });

  it("shows no review when the pull request can't be read", async () => {
    expect(await prEditReview(["pr", "edit", "9", "-t", "T"], bin)).toBe(
      undefined,
    );
  });
});

describe("prFileDiff", () => {
  it("picks one file's section of the pull request's diff", async () => {
    expect(await prFileDiff(bin, "gh:o/r:main...feat", "b.md")).toBe(
      "diff --git a/b.md b/b.md\n@@ -0,0 +1 @@\n+hi",
    );
  });
});

describe("validRange", () => {
  it("takes a pull request's branches, never an option", () => {
    expect(validRange("gh:o/r:main...feat/x")).toBe(true);
    expect(validRange("gh:o/r:main...fork:feat")).toBe(true);
    expect(validRange("gh:o/r:-X...feat")).toBe(false);
    expect(validRange("gh:o/r/../x:main...feat")).toBe(false);
  });
});
