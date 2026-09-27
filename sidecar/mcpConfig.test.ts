// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  computeServerHash,
  loadMetadataCache,
  saveMetadataCache,
} from "pi-mcp-adapter/metadata-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../shared/hostProtocol.ts";
import {
  adapterConfig,
  createMcpStore,
  readMcpFile,
  toConfig,
  toEntry,
  writeMcpFile,
  type McpEntry,
  type McpFile,
} from "./mcpConfig.ts";

let dir: string;
let path: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mcp-config-"));
  path = join(dir, "pi", "mcp.json");
  // The adapter keeps its tool cache in pi's agent dir.
  vi.stubEnv("PI_CODING_AGENT_DIR", join(dir, "pi"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const stdio: McpServerConfig = {
  type: "stdio",
  command: "npx",
  args: ["-y", "docs-mcp"],
  env: { TOKEN: "${DOCS_TOKEN}" },
};
const http: McpServerConfig = {
  type: "http",
  url: "https://mcp.example.com/mcp",
  headers: { Authorization: "Bearer x" },
};

const saved = async () => JSON.parse(await readFile(path, "utf8")) as McpFile;

describe("readMcpFile", () => {
  it("has no servers when the file is missing", async () => {
    expect(await readMcpFile(path)).toEqual({});
  });

  it("reads the file", async () => {
    await writeMcpFile(path, { mcpServers: { a: { command: "x" } } });
    expect(await readMcpFile(path)).toEqual({
      mcpServers: { a: { command: "x" } },
    });
  });

  it("refuses a file that isn't JSON", async () => {
    await writeMcpFile(path, {});
    await writeFile(path, "{ nope");
    await expect(readMcpFile(path)).rejects.toThrow(
      `${path} isn't valid JSON.`,
    );
  });

  it.each(["[]", "null", "3"])("refuses %s", async (text) => {
    await writeMcpFile(path, {});
    await writeFile(path, text);
    await expect(readMcpFile(path)).rejects.toThrow(
      `${path} should hold a JSON object.`,
    );
  });

  it("passes on other read errors", async () => {
    await expect(readMcpFile(dir)).rejects.toMatchObject({ code: "EISDIR" });
  });
});

describe("writeMcpFile", () => {
  it("creates the folder and keeps the file private", async () => {
    await writeMcpFile(path, { mcpServers: {} });
    expect(await readFile(path, "utf8")).toBe('{\n  "mcpServers": {}\n}\n');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});

describe("adapterConfig", () => {
  it("passes only the servers and settings", () => {
    const file = {
      mcpServers: { a: { command: "x" } },
      settings: { idleTimeout: 5 },
      imports: ["claude-code"],
      claudePlugins: [{ path: "~/plugin" }],
    };
    expect(adapterConfig(file)).toEqual({
      mcpServers: { a: { command: "x" } },
      settings: { idleTimeout: 5 },
    });
  });

  it("has no servers or settings for an empty file", () => {
    expect(adapterConfig({})).toEqual({ mcpServers: {} });
  });
});

describe("toConfig", () => {
  it("reads a remote server", () => {
    expect(toConfig({ url: "https://x.dev", headers: { A: "b" } })).toEqual({
      type: "http",
      url: "https://x.dev",
      headers: { A: "b" },
    });
    expect(toConfig({ url: "https://x.dev" })).toEqual({
      type: "http",
      url: "https://x.dev",
      headers: {},
    });
  });

  it("reads a local server, filling in what's missing", () => {
    expect(toConfig({ command: "x", args: ["a"], env: { K: "v" } })).toEqual({
      type: "stdio",
      command: "x",
      args: ["a"],
      env: { K: "v" },
    });
    expect(toConfig({})).toEqual({
      type: "stdio",
      command: "",
      args: [],
      env: {},
    });
  });
});

describe("toEntry", () => {
  it("writes the form's fields and keeps the others", () => {
    const previous: McpEntry = {
      type: "sse",
      socket: "/tmp/mux.sock",
      url: "https://old",
      lifecycle: "eager",
      disabled: true,
    };
    expect(toEntry(stdio, previous)).toEqual({
      lifecycle: "eager",
      disabled: true,
      command: "npx",
      args: ["-y", "docs-mcp"],
      env: { TOKEN: "${DOCS_TOKEN}" },
    });
    expect(toEntry(http, { command: "x", args: ["y"] })).toEqual({
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer x" },
    });
  });

  it("leaves out empty lists", () => {
    expect(toEntry({ type: "stdio", command: "x", args: [], env: {} })).toEqual(
      { command: "x" },
    );
    expect(toEntry({ type: "http", url: "https://x", headers: {} })).toEqual({
      url: "https://x",
    });
  });
});

describe("createMcpStore", () => {
  function cacheTools(name: string, entry: McpEntry, tools: string[]) {
    saveMetadataCache({
      version: 1,
      servers: {
        [name]: {
          configHash: computeServerHash(entry),
          tools: tools.map((t) => ({ name: t, description: "" })),
          resources: [],
          prompts: [],
          cachedAt: Date.now(),
        },
      },
    } as Parameters<typeof saveMetadataCache>[0]);
  }

  it("lists nothing without a file", async () => {
    expect(await createMcpStore(path).list()).toEqual([]);
  });

  it("adds entries as they are, after the others, skipping taken names", async () => {
    await writeMcpFile(path, { mcpServers: { a: { command: "old" } } });
    await createMcpStore(path).add({
      a: { command: "new" },
      b: { url: "https://b", auth: "oauth" },
    });
    expect((await readMcpFile(path)).mcpServers).toEqual({
      a: { command: "old" },
      b: { url: "https://b", auth: "oauth" },
    });
  });

  it("lists servers with the tools cached for their current config", async () => {
    const docs = { command: "npx" };
    await writeMcpFile(path, {
      mcpServers: {
        docs,
        off: { command: "npx", disabled: true },
        changed: { command: "new" },
      },
    });
    cacheTools("docs", docs, ["search", "fetch"]);
    cacheTools("off", { command: "npx" }, ["search"]);
    cacheTools("changed", { command: "old" }, ["stale"]);
    const empty = { args: [], env: {} };
    expect(await createMcpStore(path).list()).toEqual([
      {
        name: "docs",
        enabled: true,
        config: { type: "stdio", command: "npx", ...empty },
        tools: ["search", "fetch"],
      },
      {
        name: "off",
        enabled: false,
        config: { type: "stdio", command: "npx", ...empty },
        tools: [],
      },
      {
        name: "changed",
        enabled: true,
        config: { type: "stdio", command: "new", ...empty },
        tools: [],
      },
    ]);
  });

  it("adds a server, keeping the rest of the file", async () => {
    await writeMcpFile(path, {
      settings: { idleTimeout: 5 },
      mcpServers: { a: { command: "a" } },
    });
    await createMcpStore(path).save("docs", stdio);
    expect(await saved()).toEqual({
      settings: { idleTimeout: 5 },
      mcpServers: { a: { command: "a" }, docs: toEntry(stdio) },
    });
  });

  it("creates the file for the first server", async () => {
    await createMcpStore(path).save("docs", http);
    expect(await saved()).toEqual({ mcpServers: { docs: toEntry(http) } });
  });

  it("renames a server in place, keeping its other fields", async () => {
    await writeMcpFile(path, {
      mcpServers: {
        a: { command: "a" },
        b: { command: "b", lifecycle: "eager" },
        c: { command: "c" },
      },
    });
    await createMcpStore(path).save("renamed", stdio, "b");
    const servers = (await saved()).mcpServers!;
    expect(Object.keys(servers)).toEqual(["a", "renamed", "c"]);
    expect(servers.renamed).toEqual({ ...toEntry(stdio), lifecycle: "eager" });
  });

  it("saves a server under its own name", async () => {
    await writeMcpFile(path, { mcpServers: { docs: { command: "a" } } });
    await createMcpStore(path).save("docs", stdio, "docs");
    expect((await saved()).mcpServers).toEqual({ docs: toEntry(stdio) });
  });

  it("refuses a duplicate name or an invalid server", async () => {
    await writeMcpFile(path, { mcpServers: { a: {}, b: {} } });
    const store = createMcpStore(path);
    await expect(store.save("b", stdio, "a")).rejects.toThrow(
      "There is already a server named b.",
    );
    await expect(store.save("c", { ...stdio, command: "" })).rejects.toThrow(
      "Enter a command.",
    );
    expect((await saved()).mcpServers).toEqual({ a: {}, b: {} });
  });

  it("refuses to edit a server that isn't there", async () => {
    const store = createMcpStore(path);
    await expect(store.save("x", stdio, "gone")).rejects.toThrow(
      "There is no server named gone.",
    );
    await expect(store.remove("gone")).rejects.toThrow(
      "There is no server named gone.",
    );
    await expect(store.setEnabled("gone", true)).rejects.toThrow(
      "There is no server named gone.",
    );
  });

  it("remembers which servers need sign-in", async () => {
    const store = createMcpStore(path);
    expect(await store.needsSignIn()).toEqual([]);
    await store.setNeedsSignIn("a", true);
    await store.setNeedsSignIn("a", true);
    await store.setNeedsSignIn("b", true);
    expect(await createMcpStore(path).needsSignIn()).toEqual(["a", "b"]);
    await store.setNeedsSignIn("a", false);
    expect(await store.needsSignIn()).toEqual(["b"]);
  });

  it("treats an unreadable sign-in file as empty", async () => {
    const signIns = join(dirname(path), "mcp-sign-in.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(signIns, "{ nope");
    expect(await createMcpStore(path).needsSignIn()).toEqual([]);
    await writeFile(signIns, '{"a": 1}');
    expect(await createMcpStore(path).needsSignIn()).toEqual([]);
  });

  it("forgets a removed server needed sign-in", async () => {
    await writeMcpFile(path, { mcpServers: { a: {} } });
    const store = createMcpStore(path);
    await store.setNeedsSignIn("a", true);
    await store.remove("a");
    expect(await store.needsSignIn()).toEqual([]);
  });

  it("removes a server and forgets its cached tools", async () => {
    const a = { command: "a" };
    await writeMcpFile(path, { mcpServers: { a, b: {} } });
    cacheTools("a", a, ["search"]);
    await createMcpStore(path).remove("a");
    expect((await saved()).mcpServers).toEqual({ b: {} });
    expect(loadMetadataCache()?.servers.a).toBeUndefined();
    // Nothing cached is fine too.
    await createMcpStore(path).remove("b");
  });

  it("turns a server off and on with the adapter's disabled flag", async () => {
    await writeMcpFile(path, { mcpServers: { a: { command: "a" } } });
    const store = createMcpStore(path);
    await store.setEnabled("a", false);
    expect((await saved()).mcpServers).toEqual({
      a: { command: "a", disabled: true },
    });
    await store.setEnabled("a", true);
    expect((await saved()).mcpServers).toEqual({ a: { command: "a" } });
  });

  it("applies changes one at a time, even after one fails", async () => {
    const store = createMcpStore(path);
    await Promise.allSettled([
      store.save("a", stdio),
      store.save("a", stdio),
      store.save("b", http),
    ]);
    expect(Object.keys((await saved()).mcpServers!)).toEqual(["a", "b"]);
  });
});
