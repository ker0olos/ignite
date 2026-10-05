import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import shellEdits, { changedFiles } from "./shellEditsExtension.ts";
import { workingTree } from "./worktreeGit.ts";

let repo: string;
let index: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo });
const tree = () => workingTree(repo, index);

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "shell-edits-"));
  index = join(mkdtempSync(join(tmpdir(), "shell-index-")), "index");
  git("init", "-q", "-b", "main");
  writeFileSync(join(repo, "a.ts"), "one\ntwo\n");
  writeFileSync(join(repo, "gone.ts"), "x\n");
  symlinkSync("a.ts", join(repo, "link"));
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "i");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

it("lists what changed between two working states, with each file's diff", async () => {
  writeFileSync(join(repo, "a.ts"), "one\nzwei\n");
  const before = await tree();
  writeFileSync(join(repo, "a.ts"), "one\ndrei\n");
  writeFileSync(join(repo, "new file.ts"), "hi\n");
  rmSync(join(repo, "gone.ts"));
  const edits = await changedFiles(repo, before, await tree());

  expect(edits.map((e) => e.path)).toEqual(["a.ts", "gone.ts", "new file.ts"]);
  expect(edits[0].diff).toContain("-zwei\n+drei");
  expect(edits[1].diff).toContain("-x");
  expect(edits[2].diff).toContain("+hi");
});

it("keeps each file's diff with it when one changed type", async () => {
  const before = await tree();
  rmSync(join(repo, "link"));
  writeFileSync(join(repo, "link"), "plain\n");
  writeFileSync(join(repo, "zz.ts"), "last\n");
  const edits = await changedFiles(repo, before, await tree());

  expect(edits.map((e) => e.path)).toEqual(["link", "zz.ts"]);
  expect(edits[0].diff).toContain("+plain");
  expect(edits[1].diff).toContain("+last");
});

it("finds nothing when the command changed no file", async () => {
  const start = await tree();
  expect(await changedFiles(repo, start, await tree())).toEqual([]);
});

type Handler = (event: object, ctx: object) => Promise<unknown>;

function hooks() {
  const on: Record<string, Handler> = {};
  shellEdits({ on: (name: string, h: Handler) => (on[name] = h) } as never);
  return async (input: object, change: () => void, cwd = repo) => {
    const ctx = { cwd };
    const call = { toolName: "bash", toolCallId: "c", input };
    await on.tool_call(call, ctx);
    change();
    return on.tool_result({ ...call, details: { exit: 0 } }, ctx);
  };
}

it("adds the files each command changed to its result's details", async () => {
  const run = hooks();
  const write = (text: string) => () =>
    writeFileSync(join(repo, "new.ts"), text);
  expect(await run({ command: "x" }, write("one\n"))).toMatchObject({
    details: { exit: 0, edits: [{ path: "new.ts" }] },
  });
  const second = await run({ command: "x" }, write("two\n"));
  expect(second).toMatchObject({ details: { edits: [{ path: "new.ts" }] } });
  expect(JSON.stringify(second)).toContain("-one\\n+two");
});

it("leaves a result alone when nothing changed, outside git, or in the background", async () => {
  const run = hooks();
  const edit = () => writeFileSync(join(repo, "a.ts"), "one\n");
  expect(await run({ command: "x" }, () => {})).toBeUndefined();
  expect(await run({ command: "x", background: true }, edit)).toBeUndefined();
  expect(await run({ command: "x" }, edit, tmpdir())).toBeUndefined();
});
