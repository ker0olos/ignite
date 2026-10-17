// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import {
  activateCurrentTools,
  defaultTools,
  runtimeFor,
} from "./sessionRuntime.ts";

const { AuthStorage } = await import(
  new URL(
    "./core/auth-storage.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
);

const model = {
  id: "m",
  name: "M",
  reasoning: false,
  input: ["text" as const],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 100,
};

describe("runtimeFor", () => {
  it("gives providers the session's cwd, and keeps each session's providers apart", async () => {
    const streamSimple = vi.fn(() => {
      throw new Error("stop");
    });
    const [a, b] = await Promise.all([
      runtimeFor(AuthStorage.inMemory(), "/work/a"),
      runtimeFor(AuthStorage.inMemory(), "/work/b"),
    ]);
    a.registerProvider("fake", {
      baseUrl: "fake",
      apiKey: "not-used",
      api: "fake",
      models: [model],
      streamSimple,
    });
    expect(b.getModel("fake", "m")).toBeUndefined();
    const m = a.getModel("fake", "m")!;
    await a
      .streamSimple(m, { messages: [] }, { maxTokens: 5 })
      .result()
      .catch(() => {});
    expect(streamSimple).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ cwd: "/work/a", maxTokens: 5 }),
    );
  });
});

describe("activateCurrentTools", () => {
  // A saved conversation whose transcript last declared only `read`.
  const declaredRead = [
    {
      type: "message",
      id: "s1",
      parentId: null,
      timestamp: new Date(0).toISOString(),
      message: {
        role: "system",
        content: "",
        sections: [],
        timestamp: 0,
        toolsAdded: [{ name: "read", description: "", parameters: {} }],
      },
    },
  ];

  it("gives a reopened conversation the tools pi leaves out", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tools-"));
    const settingsManager = SettingsManager.inMemory({ defaultTools });
    const resourceLoader = new DefaultResourceLoader({
      cwd: dir,
      agentDir: dir,
      settingsManager,
      extensionFactories: [
        (pi) =>
          pi.registerTool({
            name: "extra_tool",
            label: "Extra",
            description: "Registered after the transcript was saved.",
            parameters: Type.Object({}),
            execute: async () => ({ content: [], details: {} }),
          }),
      ],
    });
    await resourceLoader.reload();
    const { session } = await createAgentSession({
      cwd: dir,
      agentDir: dir,
      settingsManager,
      resourceLoader,
      sessionManager: SessionManager.inMemory(
        dir,
        undefined,
        declaredRead as never,
      ),
    });
    // pi 1.3 restores the transcript's loadout alone.
    expect(session.getActiveToolNames()).toEqual(["read"]);
    activateCurrentTools(session);
    expect(new Set(session.getActiveToolNames())).toEqual(
      new Set([...defaultTools, "extra_tool"]),
    );
    session.dispose();
    rmSync(dir, { recursive: true, force: true });
  });
});
