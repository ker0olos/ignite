// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PRESETS,
  findImports,
  needsSignIn,
  toAdapterEntry,
} from "./mcpCatalog.ts";

let home: string;
let project: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "mcp-home-"));
  project = join(home, "work", "app");
  await mkdir(project, { recursive: true });
});
afterEach(() => rm(home, { recursive: true, force: true }));

async function put(path: string, content: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    typeof content === "string" ? content : JSON.stringify(content),
  );
}

const stdio = { command: "npx", args: ["-y", "pkg"] };
const remote = { url: "https://x.dev/mcp" };

describe("presets", () => {
  it("offers the adapter's presets and ours, each with an entry", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["context7", "playwright"]));
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRESETS) {
      expect(p.entry.url ?? p.entry.command).toBeTruthy();
    }
  });

  it("knows which presets sign in with OAuth", () => {
    expect(needsSignIn({ url: "https://x", auth: "oauth" })).toBe(true);
    expect(needsSignIn(remote)).toBe(false);
  });
});

describe("toAdapterEntry", () => {
  it("keeps a URL and its string headers, from either header field", () => {
    expect(
      toAdapterEntry({
        type: "sse",
        url: "https://x/sse",
        headers: { A: "1", B: 2 },
      }),
    ).toEqual({ url: "https://x/sse", headers: { A: "1" } });
    expect(
      toAdapterEntry({ url: "https://x", http_headers: { C: "3" } }),
    ).toEqual({ url: "https://x", headers: { C: "3" } });
    expect(toAdapterEntry({ url: "https://x", headers: { B: 2 } })).toEqual({
      url: "https://x",
    });
  });

  it("keeps a command with its string args and env", () => {
    expect(
      toAdapterEntry({
        type: "stdio",
        command: "uvx",
        args: ["a", 1],
        env: { K: "v" },
        startup_timeout_sec: 5,
      }),
    ).toEqual({ command: "uvx", args: ["a"], env: { K: "v" } });
    expect(toAdapterEntry({ command: "x", args: "nope" })).toEqual({
      command: "x",
    });
  });

  it("skips disabled or unusable entries", () => {
    expect(toAdapterEntry({ ...stdio, disabled: true })).toBeUndefined();
    expect(toAdapterEntry({ ...stdio, enabled: false })).toBeUndefined();
    expect(toAdapterEntry({ command: "" })).toBeUndefined();
    expect(toAdapterEntry({ transport: "?" })).toBeUndefined();
    expect(toAdapterEntry(["x"])).toBeUndefined();
    expect(toAdapterEntry(null)).toBeUndefined();
  });
});

describe("findImports", () => {
  it("finds nothing on a Mac without other apps' configs", async () => {
    expect(await findImports(home, project)).toEqual([]);
  });

  it("reads each app's user and project servers", async () => {
    await put(join(home, ".claude.json"), {
      mcpServers: {
        blender: { type: "stdio", command: "uvx" },
        broken: { type: "stdio" },
      },
      projects: {
        [project]: { mcpServers: { sentry: { type: "http", ...remote } } },
        "/elsewhere": { mcpServers: { other: stdio } },
      },
    });
    await put(join(project, ".mcp.json"), { mcpServers: { shared: stdio } });
    await put(join(home, ".cursor", "mcp.json"), {
      mcpServers: { c: remote },
    });
    await put(join(project, ".cursor", "mcp.json"), {
      mcpServers: { cp: stdio },
    });
    await put(
      join(home, ".codex", "config.toml"),
      '[mcp_servers.docs]\ncommand = "npx"\nargs = ["-y", "docs"]\n',
    );
    await put(
      join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      ),
      { mcpServers: { d: stdio } },
    );

    const found = await findImports(home, project);
    expect(
      found.map((s) => [s.id, s.app, s.scope, Object.keys(s.servers)]),
    ).toEqual([
      ["claude-code", "Claude Code", "user", ["blender"]],
      ["claude-code-local", "Claude Code", "project", ["sentry"]],
      ["project-mcp-json", "Claude Code", "project", ["shared"]],
      ["cursor", "Cursor", "user", ["c"]],
      ["cursor-project", "Cursor", "project", ["cp"]],
      ["codex", "Codex", "user", ["docs"]],
      ["claude-desktop", "Claude Desktop", "user", ["d"]],
    ]);
    expect(found[1].servers.sentry).toEqual(remote);
    expect(found[5].servers.docs).toEqual({
      command: "npx",
      args: ["-y", "docs"],
    });
  });

  it("leaves out project servers without an open folder", async () => {
    await put(join(home, ".claude.json"), {
      mcpServers: { blender: stdio },
      projects: { [project]: { mcpServers: { sentry: remote } } },
    });
    const found = await findImports(home, undefined);
    expect(found.map((s) => s.id)).toEqual(["claude-code"]);
  });

  it("skips files it can't read and folders Claude Code doesn't know", async () => {
    await put(join(home, ".claude.json"), "{ not json");
    await put(join(home, ".cursor", "mcp.json"), "[1, 2]");
    await put(join(home, ".codex", "config.toml"), "= broken");
    expect(await findImports(home, project)).toEqual([]);

    await put(join(home, ".claude.json"), { projects: { [project]: 1 } });
    expect(await findImports(home, project)).toEqual([]);
    await put(join(home, ".claude.json"), { projects: [] });
    expect(await findImports(home, project)).toEqual([]);
  });
});
