// @vitest-environment node
import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { expect, it, vi } from "vitest";
import type { Verdict } from "./stopJudge.ts";
import {
  ASK_NUDGE,
  CONTINUE_NUDGE,
  LESSON_NUDGE,
  STOP_EVENT,
  nudgeStops,
  type StopAsk,
} from "./stopNudge.ts";

// Conversation "waiting" has a background command its bash_wait waits on.
vi.mock("./backgroundBash.ts", () => ({
  backgroundOf: (session: string) =>
    session === "waiting" ? [{ wake: "w" }] : [],
}));

type Handler = (event: object, ctx: object) => Promise<unknown>;

function load(
  verdict: Verdict | null,
  active = ["read", "ask_user"],
  session = "s1",
) {
  const events = createEventBus();
  let end: Handler | undefined;
  const sent: string[] = [];
  const judged: (AbortSignal | undefined)[] = [];
  const lessons: boolean[] = [];
  const userWrote = nudgeStops({
    on: (_name: string, h: Handler) => (end = h),
    getActiveTools: () => active,
    sendMessage: (message: { content: string }) => sent.push(message.content),
    events,
  } as unknown as ExtensionAPI);
  const stop = new AbortController();
  let pending = false;
  // `during`: what the user does while the judge reads the run.
  let during = () => {};
  events.on(STOP_EVENT, (data) => {
    const ask = data as StopAsk;
    judged.push(ask.signal);
    lessons.push(ask.lessons);
    during();
    ask.reply(Promise.resolve(verdict));
  });
  const ctx = {
    sessionManager: { getSessionId: () => session },
    signal: stop.signal,
    hasPendingMessages: () => pending,
  };
  return {
    sent,
    judged,
    lessons,
    stop,
    meanwhile: (act: "stop" | "write") =>
      (during = () => (act === "stop" ? stop.abort() : (pending = true))),
    end: (messages: unknown[]) => end!({ messages }, ctx),
    user: (prompt = "Hi") =>
      userWrote({ messageType: "user", prompt } as never),
  };
}

const reply = (text: string, stopReason = "stop") => ({
  role: "assistant",
  stopReason,
  content: [{ type: "text", text }],
});

it("sends the agent on or has it ask, as the judge says", async () => {
  const going = load("continue");
  await going.end([reply("Next I'll do step 6.")]);
  expect(going.sent).toEqual([CONTINUE_NUDGE]);
  expect(going.judged).toEqual([going.stop.signal]);
  const asking = load("ask");
  await asking.end([reply("Push?")]);
  expect(asking.sent).toEqual([ASK_NUDGE]);
});

it("sends nothing when the user stops it or writes while it's judged", async () => {
  for (const act of ["stop", "write"] as const) {
    const { end, sent, meanwhile } = load("continue");
    meanwhile(act);
    await end([reply("Next…")]);
    expect(sent).toEqual([]);
  }
});

it("leaves a finished run alone, and one it can't judge", async () => {
  for (const verdict of ["done", null] as const) {
    const { end, sent } = load(verdict);
    await end([reply("Done.")]);
    expect(sent).toEqual([]);
  }
});

it("nudges a few times per user message, so a run that keeps stopping can't loop", async () => {
  const { end, sent, user } = load("continue");
  for (let i = 0; i < 4; i++) await end([reply("Next…")]);
  expect(sent).toHaveLength(3);
  await user();
  await end([reply("Next…")]);
  expect(sent).toHaveLength(4);
});

it("judges only replies that ended on their own, with ask_user, not waiting on a command", async () => {
  const stopped = load("continue");
  await stopped.end([reply("Next…", "aborted")]);
  await stopped.end([{ role: "toolResult" }]);
  expect(stopped.judged).toEqual([]);
  const alone = load("continue", ["read"]);
  await alone.end([reply("Next…")]);
  expect(alone.judged).toEqual([]);
  const waiting = load("continue", undefined, "waiting");
  await waiting.end([reply("Next…")]);
  expect(waiting.judged).toEqual([]);
});

it("lets the judge say lesson only while lessons are on and the run saved none", async () => {
  const on = ["read", "ask_user", "lesson_add"];
  const corrected = load("lesson", on);
  await corrected.end([reply("Sorry, I'll use your Chrome.")]);
  expect(corrected.lessons).toEqual([true]);
  expect(corrected.sent).toEqual([LESSON_NUDGE]);
  const saved = load("continue", on);
  await saved.end([
    { role: "assistant", content: [{ type: "toolCall", name: "lesson_add" }] },
    reply("Saved."),
  ]);
  expect(saved.lessons).toEqual([false]);
  const off = load("continue");
  await off.end([reply("Sorry.")]);
  expect(off.lessons).toEqual([false]);
});
