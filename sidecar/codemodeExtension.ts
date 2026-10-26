/**
 * pi's codemode (a script calling the other tools), titled by its first comment line;
 * each call it made kept on its result with that call's result, which pi's record lacks.
 */
import {
  createCodemodeExtension,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { ToolResult } from "../shared/agentTypes.ts";
import {
  CODEMODE_TOOL,
  SCRIPT_REASON_RULE,
  scriptReason,
  type ScriptCall,
} from "../shared/codemode.ts";
import { ASK_TOOL } from "../shared/questions.ts";
import { wrappedTools } from "./toolReason.ts";

// Kept on the session file with the script's result, so a chatty script can't bloat it.
export const MAX_TEXT = 4_000;
const MAX_DETAILS = 50_000;
const MAX_RECORD = 1_000_000;

type Content = ToolResult["content"];
type Script = {
  calls: ScriptCall[];
  seen: number;
  started: number;
  room: number;
};

const textOf = (content: Content) =>
  content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");

/** A call's result as the script's record keeps it: its text, cut short, and details that fit. */
export function keptResult(content: Content, details: unknown): ToolResult {
  const text = textOf(content);
  const kept: Content = [
    {
      type: "text",
      text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text,
    },
  ];
  const fits =
    details !== undefined && JSON.stringify(details).length <= MAX_DETAILS;
  return fits ? { content: kept, details } : { content: kept };
}

// The call as recorded, within what's left of the script's room: past it, only its name.
function record(script: Script, call: ScriptCall): ScriptCall {
  const size = JSON.stringify(call).length;
  if (size > script.room) {
    return { id: call.id, name: call.name, arguments: {}, status: call.status };
  }
  script.room -= size;
  return call;
}

// The rule rides on the tool's description; grammar-sampled tools take only `code`.
const titled = (pi: ExtensionAPI) =>
  wrappedTools(pi, (tool) => ({
    ...tool,
    description: `${tool.description}\n- ${SCRIPT_REASON_RULE}`,
  }));

export default function codemodeExtension(pi: ExtensionAPI) {
  void createCodemodeExtension({ models: false })(titled(pi));
  const scripts = new Map<string, Script>();

  pi.on("tool_call", (event) => {
    if (event.toolName === CODEMODE_TOOL && !event.parentToolCallId) {
      if (!scriptReason(event.input.code)) {
        return { block: true, reason: SCRIPT_REASON_RULE };
      }
      scripts.set(event.toolCallId, {
        calls: [],
        seen: 0,
        started: Date.now(),
        room: MAX_RECORD,
      });
    }
    // Its questions take over the composer, which only answers the agent's own calls.
    if (event.toolName === ASK_TOOL && event.parentToolCallId) {
      return {
        block: true,
        reason: "Call ask_user directly, not from a script.",
      };
    }
  });

  // Before any tool_call handler: approval rewrites a sandboxed command in place.
  pi.on("tool_execution_start", (event) => {
    if (!event.parentToolCallId) return;
    scripts.get(event.parentToolCallId)?.calls.push({
      id: event.toolCallId,
      name: event.toolName,
      arguments: structuredClone(event.args ?? {}),
    });
  });

  pi.on("tool_result", (event) => {
    const parent = event.parentToolCallId;
    if (parent) {
      const script = scripts.get(parent);
      const call = script?.calls.find((c) => c.id === event.toolCallId);
      if (!script || !call) return;
      call.status = event.isError ? "error" : "done";
      call.result = keptResult(event.content, event.details);
      script.seen += textOf(event.content).length;
      return;
    }
    const script = scripts.get(event.toolCallId);
    if (!script) return;
    scripts.delete(event.toolCallId);
    const calls = script.calls.map((c) =>
      record(script, c.status ? c : { ...c, status: "unfinished" }),
    );
    const own = typeof event.details === "object" ? event.details : {};
    return {
      details: {
        ...own,
        calls,
        seen: script.seen,
        durationMs: Date.now() - script.started,
      },
    };
  });
}
