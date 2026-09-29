// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../shared/tasks.ts";
import { createTaskStore } from "./taskStore.ts";

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  notes: "",
  images: [],
  subtasks: [],
  created: 1,
  updated: 1,
  ...over,
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tasks-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe.each([
  ["memory", () => null],
  ["files", () => dir],
])("task store (%s)", (_name, where) => {
  it("adds, replaces and removes, reporting each result", async () => {
    const changed = vi.fn();
    const store = createTaskStore(where(), changed);
    expect(await store.list("/a")).toEqual([]);
    await store.save("/a", task("1"));
    await store.save("/a", task("2"));
    const replaced = await store.save("/a", task("1", { title: "new" }));
    expect(replaced.map((t) => t.title)).toEqual(["new", "2"]);
    expect(await store.remove("/a", "2")).toEqual([
      task("1", { title: "new" }),
    ]);
    expect(changed).toHaveBeenCalledTimes(4);
    expect(changed).toHaveBeenLastCalledWith("/a", await store.list("/a"));
    expect(await store.list("/b")).toEqual([]);
  });

  it("edits only the task running in the session", async () => {
    const store = createTaskStore(where());
    await store.save("/a", task("1", { session: "s1" }));
    await store.save("/a", task("2", { session: "s2" }));
    await store.updateBySession("/a", "s2", (t) => ({ ...t, step: "go" }));
    expect((await store.list("/a")).map((t) => t.step)).toEqual([
      undefined,
      "go",
    ]);
  });

  it("neither writes nor reports for a session without a task", async () => {
    const changed = vi.fn();
    const store = createTaskStore(where(), changed);
    await store.save("/a", task("1", { session: "s1" }));
    changed.mockClear();
    const edit = vi.fn((t: Task) => t);
    await store.updateBySession("/a", "chat", edit);
    expect(edit).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("lands two concurrent saves", async () => {
    const store = createTaskStore(where());
    await Promise.all([
      store.save("/a", task("1")),
      store.save("/a", task("2")),
    ]);
    expect((await store.list("/a")).map((t) => t.id)).toEqual(["1", "2"]);
  });
});

describe("task store files", () => {
  it("survives a new store, and leaves no temp file", async () => {
    await createTaskStore(dir).save("/a", task("1"));
    expect(await createTaskStore(dir).list("/a")).toEqual([task("1")]);
    expect((await readdir(dir)).every((f) => f.endsWith(".json"))).toBe(true);
  });

  it("lists a corrupt file as empty, and saves over it", async () => {
    const store = createTaskStore(dir);
    await store.save("/a", task("1"));
    const [file] = await readdir(dir);
    await writeFile(join(dir, file), "{nope");
    expect(await store.list("/a")).toEqual([]);
    expect(await store.save("/a", task("2"))).toEqual([task("2")]);
  });

  it("creates its folder on first write", async () => {
    const store = createTaskStore(join(dir, "nested", "tasks"));
    expect(await store.list("/a")).toEqual([]);
    await store.save("/a", task("1"));
    expect(await store.list("/a")).toEqual([task("1")]);
  });

  it("keeps working after a change fails", async () => {
    const store = createTaskStore(dir);
    await expect(
      store.change("/a", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await store.save("/a", task("1"))).toEqual([task("1")]);
  });
});
