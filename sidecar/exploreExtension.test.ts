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

it("sends bash file searches to the grep and read tools", async () => {
  const toolCall = load().tool_call;
  const call = (toolName: string, command: string) =>
    toolCall({ toolName, input: { command } }, { cwd: "/repo" });
  expect(await call("bash", "grep -n foo src/a.ts")).toEqual({
    block: true,
    reason: USE_READ_TOOLS,
  });
  expect(await call("bash", "npm test | grep foo")).toBeUndefined();
  expect(await call("grep", "grep foo")).toBeUndefined();
});
