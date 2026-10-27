// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { USE_READ_TOOLS } from "./bashSearch.ts";
import explore, { EXPLORE_GUIDANCE } from "./exploreExtension.ts";

type Handler = (event: object, ctx?: object) => unknown;

function load() {
  const handlers: Record<string, Handler> = {};
  explore({
    registerTool: () => {},
    on: (event: string, handler: Handler) => (handlers[event] = handler),
  } as unknown as ExtensionAPI);
  return handlers;
}

it("adds the exploring guidance to each run's system prompt", () => {
  const sections = {};
  load().before_agent_start({ systemPromptOptions: { sections } });
  expect(sections).toEqual({ explore: EXPLORE_GUIDANCE });
});

it("runs a bash file search, its result pointing at the grep and read tools", async () => {
  const { tool_call, tool_result } = load();
  const run = async (toolName: string, command: string, id: string) => {
    expect(
      await tool_call(
        { toolName, toolCallId: id, input: { command } },
        { cwd: "/repo" },
      ),
    ).toBeUndefined();
    return tool_result({
      toolCallId: id,
      content: [{ type: "text", text: "found" }],
    });
  };
  expect(await run("bash", "grep -n foo src/a.ts", "1")).toEqual({
    content: [
      { type: "text", text: "found" },
      { type: "text", text: `\n${USE_READ_TOOLS}` },
    ],
  });
  expect(await run("bash", "npm test | grep foo", "2")).toBeUndefined();
  expect(await run("grep", "grep foo", "3")).toBeUndefined();
});
