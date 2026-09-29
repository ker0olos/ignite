// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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
  it("adds and removes, reporting each result", async () => {
    const changed = vi.fn();
    const store = createTaskStore(where(), changed);
    expect(await store.list("/a")).toEqual([]);
    await store.save("/a", task("1"));
    await store.save("/a", task("2"));
    expect(await store.remove("/a", "2")).toEqual([task("1")]);
    expect(changed).toHaveBeenCalledTimes(3);
    expect(changed).toHaveBeenLastCalledWith("/a", await store.list("/a"));
    expect(await store.list("/b")).toEqual([]);
  });

  it("refuses to save over an existing task", async () => {
    const store = createTaskStore(where());
    await store.save("/a", task("1"));
    await expect(store.save("/a", task("1", { title: "x" }))).rejects.toThrow(
      "That task already exists.",
    );
    expect(await store.list("/a")).toEqual([task("1")]);
  });

  it("edits only the user's fields, keeping the agent's progress", async () => {
    const changed = vi.fn();
    const store = createTaskStore(where(), changed);
    const agent = {
      session: "s1",
      step: "Editing a.ts",
      planned: true,
      pr: "https://x/pull/1",
      subtasks: [{ title: "a", status: "done" as const }],
    };
    await store.save("/a", task("1", agent));
    changed.mockClear();
    const [edited] = await store.edit("/a", "1", {
      title: "New",
      done: true,
      // a client sending more than it may
      ...({
        session: "evil",
        step: "x",
        planned: false,
        pr: "",
        id: "9",
      } as object),
    });
    expect(edited).toEqual({
      ...task("1", agent),
      title: "New",
      done: true,
      updated: expect.any(Number),
    });
    expect(edited.updated).toBeGreaterThan(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await store.list("/a")).toEqual([edited]);
  });

  it("neither writes nor reports an edit of a missing task", async () => {
    const changed = vi.fn();
    const store = createTaskStore(where(), changed);
    await store.save("/a", task("1"));
    changed.mockClear();
    await store.edit("/a", "nope", { title: "x" });
    expect(changed).not.toHaveBeenCalled();
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

  it("throws on a corrupt file, naming it, and never overwrites it", async () => {
    const store = createTaskStore(dir);
    await store.save("/a", task("1"));
    const [file] = await readdir(dir);
    await writeFile(join(dir, file), "{nope");
    await expect(store.list("/a")).rejects.toThrow(file);
    await expect(store.save("/a", task("2"))).rejects.toThrow(file);
    expect(await readFile(join(dir, file), "utf8")).toBe("{nope");
  });

  it("throws on a read error other than a missing file", async () => {
    const store = createTaskStore(dir);
    await store.save("/a", task("1"));
    const [file] = await readdir(dir);
    await rm(join(dir, file));
    await mkdir(join(dir, file));
    await expect(store.list("/a")).rejects.toThrow(file);
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
