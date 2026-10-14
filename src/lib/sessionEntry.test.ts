import { expect, it } from "vitest";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { shownItems } from "@/lib/routedMessage";
import { fromHistory } from "@/lib/transcript";
import { toOpened } from "./sessionEntry";

it("shows a first message the router is still reading, timed from its send", () => {
  const message = { role: "user" as const, content: "Fix it", timestamp: 7 };
  const opened = {
    session: "s1",
    messages: [],
    running: true,
    routing: message,
    approvals: [],
    queue: { steering: [], followUp: [] },
    models: [],
    thinkingLevel: "high",
    thinkingLevels: [],
    skills: [],
  } as unknown as OpenedSession;
  const entry = toOpened({} as HostClient, "/f", opened);
  expect(entry.transcript).toMatchObject({
    running: true,
    routing: true,
    routedAt: 7,
  });
  expect(shownItems(entry.transcript)).toEqual([{ kind: "message", message }]);
  expect(entry.state).not.toHaveProperty("routing");
});

it("catches up on tool calls that moved while the conversation was hidden", () => {
  const result = { content: [{ type: "text", text: "ok" }], details: {} };
  const opened = {
    session: "s1",
    messages: [],
    running: true,
    approvals: [],
    toolRuns: [
      { type: "tool_execution_end", toolCallId: "a", isError: false, result },
      { type: "tool_execution_update", toolCallId: "b", partialResult: result },
    ],
    queue: { steering: [], followUp: [] },
  } as unknown as OpenedSession;
  const entry = toOpened({} as HostClient, "/f", opened);
  expect(entry.transcript.tools).toEqual({
    a: { status: "done", result, approval: undefined },
    b: { status: "running", result },
  });
});

const known = {
  session: "s1",
  trust: "trusted",
  running: false,
  approvals: [],
  queue: { steering: [], followUp: [] },
  thinkingLevel: "high",
} as unknown as OpenedSession;

it("keeps the followed transcript when the reply leaves out the messages", () => {
  const kept = fromHistory(
    [{ role: "user", content: "Hi", timestamp: 1 }],
    true,
  );
  const entry = toOpened({} as HostClient, "/f", known, kept);
  expect(entry.transcript).toBe(kept);
  expect(entry).toMatchObject({
    trust: "trusted",
    state: { thinkingLevel: "high" },
  });
});

it("starts empty when the reply leaves out the messages and none were followed", () => {
  const entry = toOpened({} as HostClient, "/f", known);
  expect(shownItems(entry.transcript)).toEqual([]);
});
