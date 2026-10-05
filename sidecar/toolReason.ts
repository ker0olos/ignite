/**
 * A `reason` argument on tools whose calls may wait for the user (bash, MCP),
 * shown on the approval prompt; the tool itself never sees it.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

/** The `reason` parameter's schema. */
export const REASON = Type.Optional(
  Type.String({
    description:
      "Why you're making this call, in one plain sentence the user reads when asked to approve it " +
      "(what it does and what it's for). Give it whenever the call may change something.",
  }),
);

type Tool = Parameters<ExtensionAPI["registerTool"]>[0];
type Args = Record<string, unknown>;

/** A call's arguments as the tool takes them, without `reason`. */
export function withoutReason<T>(args: T): T {
  if (!args || typeof args !== "object") return args;
  const rest = { ...args } as Args;
  delete rest.reason;
  return rest as T;
}

/**
 * `tool` taking `reason` too, dropped before it reaches the tool's own code;
 * a tool with its own `reason` keeps it.
 */
export function withReason(tool: Tool): Tool {
  const params = tool.parameters as { type?: string; properties?: Args };
  if (params.type !== "object" || params.properties?.reason) return tool;
  const prepare = tool.prepareArguments;
  return {
    ...tool,
    parameters: {
      ...(tool.parameters as object),
      properties: { ...params.properties, reason: REASON },
    },
    ...(prepare && {
      prepareArguments: (args: unknown) => {
        const reason = (args as Args | undefined)?.reason;
        return { ...(prepare(withoutReason(args)) as Args), reason };
      },
    }),
    execute: (id, args, ...rest) =>
      tool.execute(id, withoutReason(args) as typeof args, ...rest),
  } as Tool;
}

/** `pi` with every tool registered through it taking `reason`. */
export function reasonedTools(pi: ExtensionAPI): ExtensionAPI {
  return new Proxy(pi, {
    get(target, key) {
      if (key === "registerTool") {
        return (tool: Tool) => target.registerTool(withReason(tool));
      }
      const value = Reflect.get(target, key) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
