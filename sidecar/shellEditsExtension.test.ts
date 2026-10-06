import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventBus } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, expect, it } from "vitest";
import shellEdits, {
  changedFiles,
  imageBudget,
  namesFolder,
  withImages,
} from "./shellEditsExtension.ts";
import { answerPlanned, CHANGED_UNPLANNED } from "./taskSteps.ts";
import { workingTree } from "./worktreeGit.ts";

let repo: string;
let index: string;
let scratch: string[] = [];
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};
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

afterEach(() => {
  for (const dir of [repo, ...scratch])
    rmSync(dir, { recursive: true, force: true });
  scratch = [];
});

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

it("adds a changed image's versions, one when it's new or deleted", async () => {
  writeFileSync(join(repo, "old.png"), "v1");
  writeFileSync(join(repo, "gone.png"), "g");
  const before = await tree();
  writeFileSync(join(repo, "old.png"), "v2");
  writeFileSync(join(repo, "new.svg"), "<svg/>");
  rmSync(join(repo, "gone.png"));
  const after = await tree();
  const edits = await withImages(
    repo,
    [before, after],
    await changedFiles(repo, before, after),
    imageBudget(),
  );

  expect(edits).toMatchObject([
    { path: "gone.png", before: image("g"), after: undefined },
    {
      path: "new.svg",
      before: undefined,
      after: image("<svg/>", "image/svg+xml"),
    },
    { path: "old.png", before: image("v1"), after: image("v2") },
  ]);
});

const image = (text: string, mimeType = "image/png") => ({
  type: "image",
  data: Buffer.from(text).toString("base64"),
  mimeType,
});

async function imagesWith(budget: { bytes: number }, change: () => void) {
  const before = await tree();
  change();
  const after = await tree();
  const found = await changedFiles(repo, before, after);
  return withImages(repo, [before, after], found, budget);
}

it("leaves out what doesn't fit, still adding later images that do", async () => {
  const budget = { bytes: 6 };
  const edits = await imagesWith(budget, () => {
    writeFileSync(join(repo, "a.png"), "too big");
    writeFileSync(join(repo, "b.png"), "fits");
    writeFileSync(join(repo, "c.png"), "over");
  });

  expect(edits.map((e) => e.after)).toEqual([
    undefined,
    image("fits"),
    undefined,
  ]);
  expect(budget.bytes).toBe(2);
});

it("keeps neither version of a modified image when one can't be read", async () => {
  writeFileSync(join(repo, "a.png"), "v1");
  const edits = await imagesWith({ bytes: 6 }, () =>
    writeFileSync(join(repo, "a.png"), "longer v2"),
  );

  expect(edits[0]).toEqual({ path: "a.png", diff: expect.any(String) });
});

it("shows no image for an empty file", async () => {
  const edits = await imagesWith(imageBudget(), () =>
    writeFileSync(join(repo, "empty.png"), ""),
  );

  expect(edits[0].after).toBeUndefined();
});

it("finds nothing when the command changed no file", async () => {
  const start = await tree();
  expect(await changedFiles(repo, start, await tree())).toEqual([]);
});

type Handler = (event: object, ctx: object) => Promise<unknown>;

function hooks(planned = true) {
  const on: Record<string, Handler> = {};
  const events = createEventBus();
  answerPlanned({ events }, async () => planned);
  shellEdits({
    on: (name: string, h: Handler) => (on[name] = h),
    events,
  } as never);
  return async (input: object, change: () => void, cwd = repo) => {
    const ctx = { cwd };
    const call = { toolName: "bash", toolCallId: "c", input };
    await on.tool_call(call, ctx);
    change();
    const content = [{ type: "text", text: "ok" }];
    return on.tool_result({ ...call, content, details: { exit: 0 } }, ctx);
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

it("tells the model it changed files before the work was planned", async () => {
  const run = hooks(false);
  const edit = () => writeFileSync(join(repo, "a.ts"), "unplanned\n");
  expect(await run({ command: "x" }, edit)).toMatchObject({
    details: { edits: [{ path: "a.ts" }] },
    content: [{ text: "ok" }, { text: CHANGED_UNPLANNED }],
  });
});

it("leaves a result alone when nothing changed, outside git, or in the background", async () => {
  const run = hooks();
  const edit = () => writeFileSync(join(repo, "a.ts"), "one\n");
  expect(await run({ command: "x" }, () => {})).toBeUndefined();
  expect(await run({ command: "x", background: true }, edit)).toBeUndefined();
  expect(
    await run({ command: "x" }, edit, tempDir("shell-outside-")),
  ).toBeUndefined();
});

it("finds the changes of repositories one level down a folder outside git that the command names", async () => {
  const folder = tempDir("shell-folder-");
  const inner = join(folder, "server");
  execFileSync("git", ["clone", "-q", repo, inner]);
  const edit = () => writeFileSync(join(inner, "a.ts"), "uno\n");
  const run = hooks();
  expect(
    await run({ command: "cd server&& python3 fix.py" }, edit, folder),
  ).toMatchObject({ details: { edits: [{ path: "server/a.ts" }] } });
  const again = () => writeFileSync(join(inner, "a.ts"), "dos\n");
  expect(
    await run({ command: "python3 fix.py" }, again, folder),
  ).toBeUndefined();
  expect(
    await run({ command: "ls serverless" }, again, folder),
  ).toBeUndefined();
});

it("finds the changes of a repository linked into a folder outside git", async () => {
  const folder = tempDir("shell-folder-");
  const inner = join(tempDir("shell-real-"), "server");
  execFileSync("git", ["clone", "-q", repo, inner]);
  symlinkSync(inner, join(folder, "api"));
  const edit = () => writeFileSync(join(inner, "a.ts"), "uno\n");
  expect(await hooks()({ command: "cd api && x" }, edit, folder)).toMatchObject(
    { details: { edits: [{ path: "api/a.ts" }] } },
  );
});

it.each([
  ["cd motr-server && npm test", "cd"],
  ["cd motr-server&&npm test", "cd with no spaces"],
  ["cd motr-server; ls", "before ;"],
  ["cd motr-server|cat", "before a pipe"],
  ["(cd motr-server)", "in a subshell"],
  ["echo $(cat motr-server/a.ts)", "in $(…)"],
  ["echo `cat motr-server/a.ts`", "in backticks"],
  ["cd motr-server/", "trailing slash"],
  ["sed -i s/a/b/ ./motr-server/src/a.ts", "./ relative"],
  ["cat ../motr/motr-server/a.ts", "../ relative"],
  ["prettier -w ~/Projects/motr/motr-server/src", "~ path"],
  ["cat $HOME/Projects/motr/motr-server/a.ts", "$HOME path"],
  ["cat /Users/me/Projects/motr/motr-server/a.ts", "absolute path"],
  ["type C:\\Users\\me\\motr\\motr-server\\a.ts", "Windows absolute path"],
  ["cd motr-server\\src", "Windows relative path"],
  ["cd .\\motr-server", "Windows .\\ path"],
  ["cd /c/Users/me/motr/motr-server", "Git Bash path"],
  ['cat "motr-server/a b.ts"', "double quoted"],
  ["cat 'motr-server/a.ts'", "single quoted"],
  ["python3 - <<'EOF'\np='motr-server/tests/a.ts'\nEOF", "inside a heredoc"],
  ["npm --prefix=motr-server test", "after ="],
  ["cp a.ts {motr-server,motr-expo}/", "in a brace expansion"],
  ["echo hi > motr-server/log.txt", "redirected to"],
  ["wc -l <motr-server/a.ts", "redirected from"],
  ["ls\ncd motr-server", "on a later line"],
  ["git -C motr-server status", "an argument"],
  ["docker run -v motr-server:/app node", "before : (a volume)"],
  ["PYTHONPATH=motr-server:lib python3 fix.py", "in a PATH-like list"],
  ["rm motr-server*", "before a glob"],
  ["ls *motr-server", "after a glob"],
  ["ls [motr-server]", "in brackets"],
  ["npm -w @motr-server test", "after @"],
  ["echo motr-server$SUFFIX", "before a variable"],
  ["cd motr-server=", "before ="],
  ["echo !motr-server", "after !"],
])("finds the folder named %j (%s)", (command) => {
  expect(namesFolder(command, "motr-server")).toBe(true);
});

it.each([
  ["ls", "no path"],
  ["cd motr-server-old", "a longer name"],
  ["cd old-motr-server", "a name ending with it"],
  ["cd motr-server2", "a digit after"],
  ["cat motr-server.bak", "an extension after"],
  ["cat src/motr-serverless/a.ts", "a longer segment"],
  ["echo motr_server", "a similar name"],
])("ignores %j (%s)", (command) => {
  expect(namesFolder(command, "motr-server")).toBe(false);
});

it("reads a folder's name literally, not as a pattern", () => {
  expect(namesFolder("cd c++/src", "c++")).toBe(true);
  expect(namesFolder("cd motr.server", "motr.server")).toBe(true);
  expect(namesFolder("cd motrXserver", "motr.server")).toBe(false);
  expect(namesFolder("cd app(1)/x", "app(1)")).toBe(true);
  expect(namesFolder("cd $x/a", "$x")).toBe(true);
});

it("finds a folder whose name has spaces, quoted or escaped", () => {
  expect(namesFolder('cd "my app"', "my app")).toBe(true);
  expect(namesFolder("cd my\\ app/src", "my app")).toBe(true);
  expect(namesFolder("cd my", "my app")).toBe(false);
});

it("ignores case only where the file system does", () => {
  expect(namesFolder("cd Motr-Server", "motr-server", true)).toBe(true);
  expect(namesFolder("cd Motr-Server", "motr-server", false)).toBe(false);
  expect(namesFolder("cd motr-server", "motr-server", false)).toBe(true);
});

it("finds a folder with a non-Latin name", () => {
  expect(namesFolder("cd مشروع/src", "مشروع")).toBe(true);
});
