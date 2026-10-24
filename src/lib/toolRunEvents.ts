import type { SessionEvent, ToolCall } from "../../shared/agentTypes";
import { scriptDetails, type ScriptCall } from "../../shared/codemode";
import type { ToolRun, Transcript } from "@/lib/transcript";

/** `run` merged into the call `id`'s run. */
export function setTool(t: Transcript, id: string, run: ToolRun): Transcript {
  return { ...t, tools: { ...t.tools, [id]: { ...t.tools[id], ...run } } };
}

/** pi-mcp-adapter reports failures (e.g. a server that won't connect) in details, not isError. */
export function runStatus(
  isError: boolean,
  details: unknown,
): ToolRun["status"] {
  const adapterError =
    typeof details === "object" &&
    details !== null &&
    "error" in details &&
    typeof details.error === "string";
  return isError || adapterError ? "error" : "done";
}

type ToolExecutionEvent = Extract<
  SessionEvent,
  {
    type:
      "tool_execution_start" | "tool_execution_update" | "tool_execution_end";
  }
>;

/** A tool call starting, progressing or ending; a script's calls nest under it. */
export function applyToolExecutionEvent(
  t: Transcript,
  event: ToolExecutionEvent,
): Transcript {
  switch (event.type) {
    case "tool_execution_start": {
      const { toolCallId: id, toolName: name, args, parentToolCallId } = event;
      const started = setTool(t, id, cutShort(t, parentToolCallId));
      if (!parentToolCallId) return started;
      return addNested(started, parentToolCallId, [
        { type: "toolCall", id, name, arguments: args },
      ]);
    }
    case "tool_execution_update":
      if (ended(t, event.parentToolCallId)) return t;
      return setTool(t, event.toolCallId, {
        status: "running",
        result: event.partialResult,
      });
    case "tool_execution_end":
      return cancelNested(
        setTool(t, event.toolCallId, {
          status: runStatus(event.isError, event.result.details),
          result: event.result,
          approval: undefined,
          cancelled: undefined,
          ...(event.durationMs !== undefined && {
            durationMs: event.durationMs,
          }),
        }),
        event.toolCallId,
      );
  }
}

// Whether `parent`, a script, already ended: a shown-again conversation replays its end first.
const ended = (t: Transcript, parent: string | undefined) =>
  !!parent && !!t.tools[parent] && t.tools[parent].status !== "running";

// A call starting runs, unless its script already ended and cut it short.
const cutShort = (t: Transcript, parent: string | undefined): ToolRun =>
  ended(t, parent)
    ? { status: "error", cancelled: true }
    : { status: "running" };

// A script's calls, added once each in the order they started.
function addNested(t: Transcript, parent: string, calls: ToolCall[]) {
  const known = t.tools[parent]?.nested ?? [];
  const added = calls.filter((c) => !known.some((k) => k.id === c.id));
  if (!added.length) return t;
  return setTool(t, parent, {
    status: t.tools[parent]?.status ?? "running",
    nested: [...known, ...added],
  });
}

// Calls a finished script left running were cut short with it.
function cancelNested(t: Transcript, id: string): Transcript {
  return (t.tools[id]?.nested ?? []).reduce(
    (next, call) =>
      next.tools[call.id]?.status === "running"
        ? setTool(next, call.id, { status: "error", cancelled: true })
        : next,
    t,
  );
}

// As live: an MCP failure the adapter reports in details is an error too.
function savedStatus(c: ScriptCall): ToolRun["status"] {
  if (!c.status) return "running";
  if (c.status === "unfinished") return "error";
  return runStatus(c.status === "error", c.result?.details);
}

/** A saved script's calls, from the details the sidecar recorded on its result. */
export function recordScript(
  t: Transcript,
  id: string,
  details: unknown,
): Transcript {
  const script = scriptDetails(details);
  if (!script) return t;
  const runs = script.calls.reduce(
    (next, c) =>
      setTool(next, c.id, {
        status: savedStatus(c),
        ...(c.status === "unfinished" && { cancelled: true }),
        ...(c.result && { result: c.result }),
      }),
    t,
  );
  const timed = setTool(runs, id, {
    status: runs.tools[id]?.status ?? "done",
    ...(script.durationMs !== undefined && { durationMs: script.durationMs }),
  });
  return addNested(
    timed,
    id,
    script.calls.map((c) => ({
      type: "toolCall",
      id: c.id,
      name: c.name,
      arguments: c.arguments,
    })),
  );
}
