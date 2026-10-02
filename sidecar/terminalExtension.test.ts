// @vitest-environment node
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it, vi } from "vitest";
import { closeTerminal, openTerminal, writeTerminal } from "./terminal.ts";
import terminal, { MENTION_GUIDANCE } from "./terminalExtension.ts";

vi.stubEnv("SHELL", "/bin/sh");
const cwd = realpathSync(mkdtempSync(join(tmpdir(), "terminal-ext-")));
const ctx = { cwd, sessionManager: { getSessionId: () => "conversation" } };

function load() {
  let tool: ToolDefinition | undefined;
  let beforeRun: ((event: unknown, c: typeof ctx) => unknown) | undefined;
  terminal({
    registerTool: (t: ToolDefinition) => (tool = t),
    on: (_event: string, handler: typeof beforeRun) => (beforeRun = handler),
  } as unknown as ExtensionAPI);
  const read = (params: object) =>
    tool!.execute("call", params, undefined, undefined, ctx as never);
  return { read, beforeRun: () => beforeRun!({ systemPrompt: "Base" }, ctx) };
}

let id: string;
afterEach(() => closeTerminal(id));

it("adds the user's new terminal output to the next run, then reads it on request", async () => {
  ({ terminal: id } = openTerminal(cwd, 80, 24, () => {}));
  const { read, beforeRun } = load();
  writeTerminal(id, "echo from-user\r");
  await vi.waitFor(async () =>
    expect(JSON.stringify(await read({ terminal: id }))).toContain(
      "\\nfrom-user",
    ),
  );
  // Reading marked it seen; new output comes with the next run.
  const systemPrompt = `Base\n\n${MENTION_GUIDANCE}`;
  expect(beforeRun()).toEqual({ systemPrompt });
  writeTerminal(id, "echo again\r");
  await vi.waitFor(() =>
    expect(beforeRun()).toEqual({
      systemPrompt,
      message: {
        customType: "terminal",
        content: expect.stringContaining("again"),
        display: false,
      },
    }),
  );
});
