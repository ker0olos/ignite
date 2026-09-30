import { describe, expect, it, vi } from "vitest";
import {
  DEMO_PROMPT,
  hostOpener,
  shownRows,
  shownSession,
  typedText,
} from "./demo";
import { DEMO_STATUSES } from "./demoAnswers";
import { createDemoHost, DEMO_REPLY, DEMO_STATE } from "./demoHost";
import { openPiHost } from "./piHost";

const TEMPO = "/repo/demo/tempo";
const PANTRY = "/repo/demo/pantry";

describe("shownSession", () => {
  it("shows the host's error when the session has none", () => {
    const session = { error: null, other: 1 };
    expect(shownSession(session, "Host failed")).toEqual({
      error: "Host failed",
      other: 1,
    });
    expect(shownSession({ error: "No model" }, "Host failed").error).toBe(
      "No model",
    );
  });
});

describe("hostOpener", () => {
  it("starts the sidecar, or in demo mode the demo host", async () => {
    expect(hostOpener(null)).toBe(openPiHost);
    const host = await hostOpener(TEMPO)();
    expect(await host.request({ type: "status" })).toBe(DEMO_STATUSES);
  });
});

describe("typedText", () => {
  it("types the demo's prompt whatever the keys, outside demo mode what was typed", () => {
    expect(typedText("zzz", TEMPO)).toBe(DEMO_PROMPT.slice(0, 3));
    expect(typedText("z".repeat(999), TEMPO)).toBe(DEMO_PROMPT);
    expect(typedText("", TEMPO)).toBe("");
    expect(typedText("zzz", null)).toBe("zzz");
  });
});

describe("shownRows", () => {
  it("passes a folder's conversations through outside demo mode", () => {
    const rows = () => [];
    expect(shownRows(rows, null)).toBe(rows);
  });

  it("shows tempo with four conversations at once, and pantry waiting", () => {
    const rows = shownRows(() => [], TEMPO);
    expect(rows(TEMPO).map((a) => [a.session, a.running, a.waiting])).toEqual([
      ["tempo", false, false],
      ["tempo-tests", true, true],
      ["tempo-reload", true, false],
      ["tempo-bugs", true, true],
    ]);
    expect(rows(PANTRY)).toMatchObject([{ session: "pantry", waiting: true }]);
  });
});

describe("the demo host", () => {
  const listen = (host: ReturnType<typeof createDemoHost>) => {
    const heard = vi.fn();
    return { heard, off: host.subscribe(heard) };
  };

  it("opens a folder's first conversation, the one asked for, or a new one", async () => {
    const host = createDemoHost(TEMPO);
    const first = await host.request({ type: "open_session", cwd: TEMPO });
    expect(first).toMatchObject({ session: "tempo", running: false });
    const waiting = await host.request({
      type: "open_session",
      cwd: TEMPO,
      session: "tempo-tests",
    });
    expect(waiting!.approvals[0].review).toMatchObject({ kind: "pr" });
    const made = await host.request({ type: "new_session", cwd: TEMPO });
    expect(made).toMatchObject({ session: "demo-1", messages: [] });
    expect(
      await host.request({ type: "open_session", cwd: "/elsewhere" }),
    ).toBeNull();
  });

  it("shows a working conversation's running call once opened, until unsubscribed", async () => {
    const host = createDemoHost(TEMPO, 0);
    const { heard, off } = listen(host);
    await host.request({
      type: "open_session",
      cwd: TEMPO,
      session: "tempo-reload",
    });
    await vi.waitFor(() => expect(heard).toHaveBeenCalledOnce());
    expect(heard.mock.calls[0][0]).toMatchObject({
      type: "session_event",
      session: "tempo-reload",
      event: { type: "tool_execution_start", toolName: "edit" },
    });
    off();
    await host.request({
      type: "open_session",
      cwd: TEMPO,
      session: "tempo-reload",
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(heard).toHaveBeenCalledOnce();
  });

  it("answers a message with the scripted reply, streamed", async () => {
    const host = createDemoHost(TEMPO, 0);
    const { heard } = listen(host);
    await host.request({ type: "prompt", text: "hi", session: "demo-1" });
    await vi.waitFor(() =>
      expect(heard).toHaveBeenLastCalledWith(
        expect.objectContaining({ event: { type: "agent_settled" } }),
      ),
    );
    const events = heard.mock.calls.map((c) => c[0].event);
    expect(events[1]).toMatchObject({
      type: "message_start",
      message: { role: "user", content: "hi" },
    });
    const streamed = events
      .map((e) => e.assistantMessageEvent?.delta ?? "")
      .join("");
    expect(streamed).toBe(DEMO_REPLY);
    await host.request({ type: "prompt", text: "no conversation" });
  });

  it("reads conversations, their details, the demo's diffs and settings", async () => {
    const host = createDemoHost(TEMPO);
    const read = { cwd: TEMPO, session: "pantry" };
    expect(
      await host.request({ type: "read_session", ...read }),
    ).not.toHaveLength(0);
    expect(
      await host.request({ type: "session_details", ...read }),
    ).toMatchObject({ toolCalls: 3 });
    expect(
      await host.request({ type: "session_details", cwd: TEMPO, session: "x" }),
    ).toBeNull();
    const diff = await host.request({
      type: "git_diff",
      repo: TEMPO,
      range: "staged",
      path: "src/theme.ts",
    });
    expect(diff).toMatch(/^@@ -0,0 \+1,/);
    expect(await host.request({ type: "session_state" })).toBe(DEMO_STATE);
    expect(await host.request({ type: "mcp_list" })).toHaveLength(2);
    expect(await host.request({ type: "abort" })).toBeUndefined();
  });

  it("searches the demo's conversations and files", async () => {
    const host = createDemoHost(TEMPO);
    const found = await host.request({
      type: "command_search",
      text: "dark",
      folders: [TEMPO, PANTRY],
      kinds: ["conversation", "file"],
      limit: 5,
    });
    expect(found.conversations[0]).toMatchObject({
      id: "tempo",
      folder: TEMPO,
    });
    const files = await host.request({
      type: "command_search",
      text: "timer",
      folders: [TEMPO, "/else"],
      kinds: ["file"],
      limit: 5,
    });
    expect(files.conversations).toEqual([]);
    expect(files.files[0]).toEqual({ folder: TEMPO, path: "src/timer.ts" });
  });
});
