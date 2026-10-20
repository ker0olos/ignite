// @vitest-environment node
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addKey,
  describe as describeKeys,
  fallbackFile,
  loadKeys,
  moveKey,
  removeKey,
} from "./fallbackKeys.ts";

let file: string;
beforeEach(async () => {
  file = join(await mkdtemp(join(tmpdir(), "fallback-")), "sub", "keys.json");
});

const order = (keys: { key: string }[]) => keys.map((k) => k.key);

describe("fallback keys", () => {
  it("live in the app's folder", () => {
    expect(fallbackFile("/home/u")).toBe("/home/u/.ignite/fallback-keys.json");
  });

  it("are none until one is added, or when the file is unreadable", async () => {
    expect(await loadKeys(file)).toEqual([]);
    await addKey("sk-1", file);
    await writeFile(file, "{");
    expect(await loadKeys(file)).toEqual([]);
    await writeFile(file, '{"keys": 3}');
    expect(await loadKeys(file)).toEqual([]);
  });

  it("are saved in order, owner-only and trimmed", async () => {
    await addKey(" sk-ant-1234 ", file);
    await addKey("sk-ant-5678", file);
    expect(order(await loadKeys(file))).toEqual(["sk-ant-1234", "sk-ant-5678"]);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, "utf8")).keys).toHaveLength(2);
  });

  it("refuse what can't be a key", async () => {
    await expect(addKey("!cat k", file)).rejects.toThrow(
      "doesn't look like an API key",
    );
    expect(await loadKeys(file)).toEqual([]);
  });

  it("show the app only their last characters", async () => {
    const keys = await addKey("sk-ant-1234", file);
    expect(describeKeys(keys)).toEqual([{ id: keys[0]!.id, hint: "1234" }]);
  });

  it("move one place at a time, never past either end", async () => {
    await addKey("a", file);
    await addKey("b", file);
    const [a, b] = await loadKeys(file);
    expect(order(await moveKey(b!.id, -1, file))).toEqual(["b", "a"]);
    expect(order(await moveKey(b!.id, -1, file))).toEqual(["b", "a"]);
    expect(order(await moveKey(a!.id, 1, file))).toEqual(["b", "a"]);
    expect(order(await moveKey("gone", 1, file))).toEqual(["b", "a"]);
  });

  it("are removed by id", async () => {
    const [a] = await addKey("a", file);
    await addKey("b", file);
    expect(order(await removeKey(a!.id, file))).toEqual(["b"]);
    expect(order(await loadKeys(file))).toEqual(["b"]);
  });
});
