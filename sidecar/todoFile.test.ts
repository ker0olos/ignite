// @vitest-environment node
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { deleteTodo, parseTodo, readTodos } from "./todoFile.ts";

const TODO = `# App — TODO

## Ads

1. **Voice notes.** Gemini TTS is cheap
   until Dec 31.
   - a nested point
2. ~~**Old thing.**~~ CLOSED yesterday.
3. **Gate was off.** FIXED today.

Loose paragraph, not an item.

- Deploy the server. Then set the
  callback.
- Short one
`;

it("reads each open top-level item under its section, joining wrapped lines", () => {
  expect(parseTodo(TODO)).toEqual([
    {
      title: "Voice notes",
      notes: "Gemini TTS is cheap until Dec 31.\n- a nested point",
      section: "Ads",
    },
    {
      title: "Deploy the server.",
      notes: "Then set the callback.",
      section: "Ads",
    },
    { title: "Short one", notes: "", section: "Ads" },
  ]);
});

it("reads CRLF files, cuts a title at a nested item, and skips closed ones", () => {
  const text = [
    "- No period",
    "  - nested point",
    "- DONE: deploy the server",
    "1. **~~Old thing~~** gone",
    "",
  ].join("\r\n");
  expect(parseTodo(text)).toEqual([
    { title: "No period", notes: "- nested point", section: undefined },
  ]);
});

it("reads the folder's .todo and those of folders directly in it", async () => {
  const root = await mkdtemp(join(tmpdir(), "todo-"));
  await mkdir(join(root, "server"));
  await mkdir(join(root, "app"));
  await mkdir(join(root, ".hidden"));
  await writeFile(join(root, ".todo"), "- Root item\n");
  await writeFile(join(root, "server", ".todo"), "- Server item\n");
  await writeFile(join(root, ".hidden", ".todo"), "- Hidden item\n");
  expect(
    (await readTodos(root)).map(({ folder, title }) => [folder, title]),
  ).toEqual([
    ["", "Root item"],
    ["server", "Server item"],
  ]);
  expect(await readTodos(join(root, "missing"))).toEqual([]);
});

it("deletes an item's lines from its file, keeping the rest", async () => {
  const root = await mkdtemp(join(tmpdir(), "todo-"));
  await mkdir(join(root, "server"));
  const path = join(root, "server", ".todo");
  await writeFile(path, TODO.replaceAll("\n", "\r\n"));
  const [voice] = await readTodos(root);
  const left = await deleteTodo(root, voice);
  expect(left.map((i) => i.title)).toEqual(["Deploy the server.", "Short one"]);
  const text = await readFile(path, "utf8");
  expect(text).toContain("## Ads\r\n\r\n2. ~~**Old thing.**~~");
  expect(text).not.toContain("nested point");
  await deleteTodo(root, voice);
  expect(await readFile(path, "utf8")).toBe(text);
});
