import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { expect, it, vi } from "vitest";
import { reasonedTools, withReason } from "./toolReason.ts";

type Tool = Parameters<ExtensionAPI["registerTool"]>[0];

const tool = (extra: Partial<Tool> = {}) =>
  ({
    name: "t",
    label: "T",
    description: "",
    parameters: Type.Object({ sql: Type.String() }),
    execute: vi.fn(async () => ({ content: [], details: {} })),
    ...extra,
  }) as Tool;

it("takes a reason the tool never sees", async () => {
  const inner = tool();
  const wrapped = withReason(inner);
  const params = wrapped.parameters as unknown as {
    properties: object;
    required: string[];
  };
  expect(Object.keys(params.properties)).toEqual(["sql", "reason"]);
  expect(params.required).toEqual(["sql"]);
  const ctx = {} as Parameters<Tool["execute"]>[4];
  const args = { sql: "x", reason: "why" };
  await wrapped.execute("id", args, undefined, undefined, ctx);
  expect(inner.execute).toHaveBeenCalledWith(
    "id",
    { sql: "x" },
    undefined,
    undefined,
    ctx,
  );
});

it("prepares arguments without the reason, keeping it for the call", () => {
  const prepareArguments = vi.fn((args: unknown) => args as { sql: string });
  const wrapped = withReason(tool({ prepareArguments }));
  expect(wrapped.prepareArguments?.({ sql: "x", reason: "why" })).toEqual({
    sql: "x",
    reason: "why",
  });
  expect(prepareArguments).toHaveBeenCalledWith({ sql: "x" });
});

it("leaves tools that don't take an object, or take their own reason, alone", () => {
  const inner = tool({ parameters: Type.String() as never });
  expect(withReason(inner)).toBe(inner);
  const own = tool({
    parameters: Type.Object({ reason: Type.Literal("fraudulent") }) as never,
  });
  expect(withReason(own)).toBe(own);
});

it("adds the reason to every tool registered through pi", () => {
  const registerTool = vi.fn();
  const on = vi.fn();
  const proxied = reasonedTools({
    registerTool,
    on,
  } as unknown as ExtensionAPI);
  proxied.registerTool(tool());
  proxied.on("tool_call", () => {});
  expect(registerTool.mock.calls[0][0].parameters.properties).toHaveProperty(
    "reason",
  );
  expect(on).toHaveBeenCalled();
});
