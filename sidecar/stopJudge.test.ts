// @vitest-environment node
import { expect, it, vi } from "vitest";
import { judgeInput, judgeStop } from "./stopJudge.ts";

const model = (id: string, output: number) =>
  ({
    provider: "anthropic",
    id,
    name: id,
    cost: { output },
    input: ["text"],
  }) as never;
const MODELS = [model("opus", 25), model("haiku", 5)];

const text = (role: string, t: string) => ({
  role,
  content: [{ type: "text", text: t }],
  timestamp: 1,
});
const RUN = [
  text("user", "Old request"),
  text("user", "Add dark mode"),
  { role: "custom", content: "hidden", timestamp: 2 },
  text("assistant", "Next I'll do the sidebar."),
] as never[];

const session = (
  answer: () => Promise<object>,
  current: (typeof MODELS)[number] | null = MODELS[0],
) => {
  const completeSimple = vi.fn(answer);
  const s = {
    model: current,
    messages: RUN,
    modelRuntime: {
      getAvailable: async () => MODELS,
      getModels: () => MODELS,
      completeSimple,
    },
  } as never;
  return { s, completeSimple };
};
const says =
  (t: string, stopReason = "stop") =>
  async () => ({
    stopReason,
    content: [{ type: "thinking" }, { type: "text", text: t }],
  });

it("asks the cheapest model for its one-word verdict", async () => {
  const stop = new AbortController();
  const { s, completeSimple } = session(says(" Continue.\n"));
  expect(await judgeStop(s, stop.signal)).toBe("continue");
  const [picked, context, options] = completeSimple.mock
    .calls[0] as unknown as [
    { id: string },
    { messages: { content: string }[] },
    { cacheRetention: string; signal: AbortSignal },
  ];
  expect(picked.id).toBe("haiku");
  expect(context.messages[0].content).toBe(judgeInput(RUN));
  expect(options.cacheRetention).toBe("none");
  stop.abort();
  expect(options.signal.aborted).toBe(true);
  expect(await judgeStop(session(says("ask")).s)).toBe("ask");
  expect(await judgeStop(session(says("done")).s)).toBe("done");
});

it("can't judge without a priced model, or without a one-word answer", async () => {
  expect(await judgeStop(session(says("ask"), null).s)).toBe(null);
  expect(await judgeStop(session(says("Not done: continue")).s)).toBe(null);
  expect(await judgeStop(session(says("ask", "error")).s)).toBe(null);
  const failed = session(() => Promise.reject(new Error("offline")));
  expect(await judgeStop(failed.s)).toBe(null);
});

it("reads the user's messages in the run that just ended, so work asked mid-run isn't lost, and the run's last messages", () => {
  const input = judgeInput(RUN);
  expect(input).toContain("Old request");
  expect(input).toContain("Add dark mode");
  expect(input).toContain("Next I'll do the sidebar.");
  expect(input).not.toContain("hidden");
  const reply = (t: string, stopReason: string) => ({
    ...text("assistant", t),
    stopReason,
  });
  const runs = judgeInput([
    text("user", "Add dark mode"),
    reply("Dark mode is in.", "stop"),
    text("user", "First"),
    reply("Working", "toolUse"),
    text("user", "Second"),
    text("user", "Third"),
    text("user", "Fourth"),
    reply("Done with the PRs.", "stop"),
  ] as never[]);
  // An earlier run's finished ask isn't read again; at most 3 of this run's.
  expect(runs).not.toContain("Add dark mode");
  expect(runs).not.toContain("First");
  expect(runs).toContain("Second");
  expect(runs).toContain("Fourth");
  const pasted = judgeInput([
    text("user", `Fix the crash below\n${"log line\n".repeat(1000)}`),
    reply("Fixed.", "stop"),
  ] as never[]);
  expect(pasted).toContain("Fix the crash below");
  const long = [
    text("user", "Fix it"),
    ...Array.from({ length: 10 }, (_, i) => text("assistant", `step ${i}`)),
  ] as never[];
  const kept = judgeInput(long);
  expect(kept).toContain("Fix it");
  expect(kept).toContain("step 9");
  expect(kept).not.toContain("step 3");
  expect(judgeInput([text("assistant", "Hi")] as never[])).toContain("Hi");
});
