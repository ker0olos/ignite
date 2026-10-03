// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import explore, { EXPLORE_GUIDANCE } from "./exploreExtension.ts";

it("adds the exploring guidance to each run's system prompt", () => {
  let beforeRun: ((event: { systemPrompt: string }) => unknown) | undefined;
  explore({
    on: (_event: string, handler: typeof beforeRun) => (beforeRun = handler),
  } as unknown as ExtensionAPI);
  expect(beforeRun!({ systemPrompt: "Base" })).toEqual({
    systemPrompt: `Base\n\n${EXPLORE_GUIDANCE}`,
  });
});
