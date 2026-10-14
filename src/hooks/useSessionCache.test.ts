import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { applyEvent } from "@/lib/transcript";
import { KEPT, useSessionCache } from "./useSessionCache";

const host = {} as HostClient;
const hello = { role: "user" as const, content: "Hi", timestamp: 1 };
const reply = (session: string, withMessages = true) =>
  ({
    session,
    ...(withMessages && { messages: [hello] }),
    running: false,
    trust: "ask",
    approvals: [],
    queue: { steering: [], followUp: [] },
  }) as unknown as OpenedSession;
const start = { type: "agent_start" } as const;

function setup(h: HostClient | null = host, folder = "/a") {
  return renderHook(({ h, folder }) => useSessionCache(h, folder), {
    initialProps: { h, folder },
  });
}

describe("useSessionCache", () => {
  it("applies events to a kept conversation while another shows", () => {
    const { result } = setup();
    act(() => void result.current.show("/a", reply("s1")));
    act(() => void result.current.show("/a", reply("s2")));
    act(() => result.current.apply("s1", (t) => applyEvent(t, start)));
    expect(result.current.current?.session).toBe("s2");
    act(() => void result.current.reshow("/a", "s1"));
    expect(result.current.current).toMatchObject({
      session: "s1",
      transcript: { running: true },
    });
  });

  it("ignores events for conversations it doesn't keep, or another host's", () => {
    const { result, rerender } = setup();
    act(() => void result.current.show("/a", reply("s1")));
    rerender({ h: {} as HostClient, folder: "/a" });
    act(() => result.current.apply("s1", (t) => applyEvent(t, start)));
    act(() => result.current.apply("s9", (t) => applyEvent(t, start)));
    rerender({ h: host, folder: "/a" });
    expect(result.current.current).toMatchObject({
      transcript: { running: false },
    });
  });

  it("keeps the followed transcript when the reply leaves out the messages", () => {
    const { result } = setup();
    act(() => void result.current.show("/a", reply("s1")));
    act(() => result.current.apply("s1", (t) => applyEvent(t, start)));
    let shown = false;
    act(() => void (shown = result.current.show("/a", reply("s1", false))));
    expect(shown).toBe(true);
    expect(result.current.current).toMatchObject({
      transcript: { running: true },
    });
  });

  it("refuses a reply without messages for a conversation it no longer keeps", () => {
    const { result } = setup();
    let shown = true;
    act(() => void (shown = result.current.show("/a", reply("s1", false))));
    expect(shown).toBe(false);
    expect(result.current.current).toBeNull();
  });

  it("reshows only a followed conversation, not one still starting", () => {
    const { result } = setup();
    act(() => result.current.preview("/a", "s1", [hello]));
    expect(result.current.reshow("/a", "s1")).toBe(false);
    expect(result.current.reshow("/a", "s9")).toBe(false);
    expect(result.current.knownIn("/a")).toBeUndefined();
    act(() => void result.current.show("/a", reply("s1")));
    expect(result.current.knownIn("/a")).toBe("s1");
  });

  it("keeps the latest conversations and those a folder shows, newest first", () => {
    const { result } = setup();
    act(() => void result.current.show("/b", reply("b1")));
    for (let i = 0; i < KEPT + 2; i++) {
      act(() => void result.current.show("/a", reply(`a${i}`)));
    }
    const kept = result.current.kept.map((o) => o.session);
    expect(kept).toHaveLength(KEPT);
    expect(kept[0]).toBe(`a${KEPT + 1}`);
    expect(result.current.reshow("/a", "a0")).toBe(false);
    // Out of the recent list, but still what /b shows.
    expect(result.current.knownIn("/b")).toBe("b1");
  });

  it("sets trust on every kept conversation of the folder", () => {
    const { result } = setup();
    act(() => void result.current.show("/b", reply("b1")));
    act(() => void result.current.show("/a", reply("a1")));
    act(() => void result.current.show("/a", reply("a2")));
    act(() => result.current.setTrust("/a", "trusted"));
    const trust = Object.fromEntries(
      result.current.kept.map((o) => [o.session, o.trust]),
    );
    expect(trust).toEqual({ a1: "trusted", a2: "trusted", b1: "ask" });
  });

  it("sets the model on the conversation just shown, before it renders", () => {
    const { result } = setup();
    act(() => {
      result.current.show("/a", reply("s1"));
      result.current.setState({ models: [] } as never);
    });
    expect(result.current.current).toMatchObject({ state: { models: [] } });
  });

  it("forgets a closed conversation", () => {
    const { result } = setup();
    act(() => void result.current.show("/a", reply("s1")));
    act(() => result.current.drop("s1"));
    expect(result.current.kept).toEqual([]);
    expect(result.current.current).toBeNull();
  });

  it("shows nothing without a host", () => {
    const { result } = setup(null);
    act(() => void result.current.show("/a", reply("s1")));
    act(() => result.current.preview("/a", "s1", [hello]));
    expect(result.current.reshow("/a", "s1")).toBe(false);
    expect(result.current.current).toBeNull();
  });
});
