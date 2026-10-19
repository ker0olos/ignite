import { expect, it } from "vitest";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { shownItems } from "@/lib/routedMessage";
import { fromHistory } from "@/lib/transcript";
import { cacheState } from "@/lib/sessionStateCache";
import {
  STARTING_PANE,
  toOpened,
  toStarting,
  view,
  withStartingPane,
} from "./sessionEntry";

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

it("shows a starting conversation's last known model and effort, not yet ready", () => {
  const host = {} as HostClient;
  const last = { ...known, models: [], thinkingLevels: [], skills: [] };
  cacheState("starting-s1", last);
  const starting = toStarting(host, "/f", "starting-s1", []);
  expect(view(starting, null)).toMatchObject({
    state: { thinkingLevel: "high" },
    ready: false,
  });
  expect(view(toOpened(host, "/f", known), null).ready).toBe(true);
  expect(view({ host, folder: "/f", session: null }, null)).toMatchObject({
    state: null,
    ready: false,
    none: true,
  });
});

it("knows where the agent works once it's open, not while it starts", () => {
  const host = {} as HostClient;
  const opened = { ...known, workdir: "/wt/s1" } as OpenedSession;
  expect(view(toOpened(host, "/f", opened), null).workdir).toBe("/wt/s1");
  const kept = fromHistory([], false);
  expect(toOpened(host, "/f", opened, kept).workdir).toBe("/wt/s1");
  expect(view(toStarting(host, "/f", "s1", []), null).workdir).toBeNull();
  expect(view({ host, folder: "/f", session: null }, null).workdir).toBeNull();
});

it("shows a first message in a pane of its own, only in its folder, then in its conversation's", () => {
  const host = {} as HostClient;
  const message = { role: "user" as const, content: "Go", timestamp: 1 };
  const s1 = {
    host,
    folder: "/f",
    session: "s1",
    workdir: null,
    state: null,
    trust: null,
    transcript: fromHistory([], false),
  };
  const starting = { folder: "/f", message };
  const panes = withStartingPane([s1], starting, host, "/f");
  expect(panes.map((o) => o.session)).toEqual(["s1", STARTING_PANE]);
  expect(panes[1].transcript.pending).toBe(message);
  expect(withStartingPane([s1], starting, host, "/other")).toEqual([s1]);
  const known = { ...starting, session: "s1" };
  const mapped = withStartingPane([s1], known, host, "/other");
  expect(mapped[0].transcript.pending).toBe(message);
  expect(withStartingPane([s1], null, host, "/f")).toEqual([s1]);
});
