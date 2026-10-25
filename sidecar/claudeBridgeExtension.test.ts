// @vitest-environment node
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// An agent dir that doesn't exist yet, as on a first launch.
vi.stubEnv(
  "PI_CODING_AGENT_DIR",
  join(realpathSync(mkdtempSync(join(tmpdir(), "bridge-"))), "agent"),
);

const bridge = vi.hoisted(() => ({
  seam: { setQuery: vi.fn() } as
    { setQuery: ReturnType<typeof vi.fn> } | undefined,
  cwdWhileLoading: "",
}));
vi.mock("pi-claude-bridge/src/index.ts", () => ({
  default: vi.fn(() => {
    bridge.cwdWhileLoading = process.cwd();
  }),
  get __test() {
    return bridge.seam;
  },
}));
const query = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query }));

const { default: claudeBridge, guarded } =
  await import("./claudeBridgeExtension.ts");

describe("guarded", () => {
  it("runs Claude Code on user settings only, with no hooks and its own executable", () => {
    expect(
      guarded({
        cwd: "/wt/a",
        settings: { includeGitInstructions: false },
        pathToClaudeCodeExecutable: "/wt/a/evil.sh",
      }),
    ).toEqual({
      cwd: "/wt/a",
      settingSources: ["user"],
      settings: { includeGitInstructions: false, disableAllHooks: true },
    });
    expect(
      guarded({ settingSources: ["user", "project"] }).settingSources,
    ).toEqual(["user"]);
    expect(guarded({ settingSources: [] }).settingSources).toEqual([]);
    expect(guarded().settings).toEqual({ disableAllHooks: true });
  });
});

describe("claudeBridge", () => {
  it("guards every query, and loads the bridge away from the worktree", () => {
    const at = process.cwd();
    claudeBridge({} as never);
    expect(bridge.cwdWhileLoading).toBe(getAgentDir());
    expect(process.cwd()).toBe(at);
    const wrapped = bridge.seam!.setQuery.mock.calls[0][0];
    wrapped({ prompt: "hi", options: { pathToClaudeCodeExecutable: "/x" } });
    expect(query).toHaveBeenCalledWith({
      prompt: "hi",
      options: {
        settingSources: ["user"],
        settings: { disableAllHooks: true },
      },
    });
  });

  it("refuses to load a bridge it can't guard", () => {
    bridge.seam = undefined;
    expect(() => claudeBridge({} as never)).toThrow(/guard/);
  });
});

it("the installed bridge still has the query seam the guard needs", async () => {
  const real = await vi.importActual<{ __test?: { setQuery?: unknown } }>(
    "pi-claude-bridge/src/index.ts",
  );
  expect(typeof real.__test?.setQuery).toBe("function");
});
