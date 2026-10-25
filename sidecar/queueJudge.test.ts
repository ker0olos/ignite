// @vitest-environment node
import { expect, it, vi } from "vitest";
import { judgeQueued } from "./queueJudge.ts";
import { judgeInput } from "./stopJudge.ts";

const model = (id: string, output: number, input = ["text", "image"]) =>
  ({ provider: "anthropic", id, name: id, cost: { output }, input }) as never;
const MODELS = [model("opus", 25), model("haiku", 5)];
const image = { type: "image" as const, data: "AA==", mimeType: "image/png" };

const RUN = [
  {
    role: "user",
    content: [{ type: "text", text: "Add dark mode" }],
    timestamp: 1,
  },
] as never[];

const session = (
  answer: () => Promise<object>,
  current: (typeof MODELS)[number] | null = MODELS[0],
  models = MODELS,
) => {
  const completeSimple = vi.fn(answer);
  const s = {
    model: current,
    messages: RUN,
    modelRuntime: {
      getAvailable: async () => models,
      getModels: () => models,
      completeSimple,
    },
  } as never;
  return { s, completeSimple };
};
const says =
  (t: string, stopReason = "stop") =>
  async () => ({ stopReason, content: [{ type: "text", text: t }] });
type Call = [
  { id: string },
  { messages: { content: unknown }[] },
  { cacheRetention: string; signal: AbortSignal },
];

it("asks the cheapest model whether the message steers or waits", async () => {
  const { s, completeSimple } = session(says(" Steer.\n"));
  const stop = new AbortController();
  expect(
    await judgeQueued(s, "use the sidebar's colours", undefined, stop.signal),
  ).toBe("steer");
  const [picked, context, options] = completeSimple.mock
    .calls[0] as unknown as Call;
  expect(picked.id).toBe("haiku");
  expect(context.messages[0].content).toBe(
    `${judgeInput(RUN)}\n\nNew message:\nuse the sidebar's colours`,
  );
  expect(options.cacheRetention).toBe("none");
  stop.abort();
  expect(options.signal.aborted).toBe(true);
  expect(await judgeQueued(session(says("later")).s, "then")).toBe("followUp");
});

it("shows the message's images to a model that reads them", async () => {
  const reads = session(says("steer"));
  await judgeQueued(reads.s, "this is wrong", [image]);
  const [, context] = reads.completeSimple.mock.calls[0] as unknown as Call;
  expect(context.messages[0].content).toEqual([
    { type: "text", text: expect.stringContaining("this is wrong") },
    image,
  ]);
  const blind = [model("opus", 25), model("haiku", 5, ["text"])];
  const textOnly = session(says("steer"), blind[0], blind);
  await judgeQueued(textOnly.s, "this is wrong", [image]);
  const [, sent] = textOnly.completeSimple.mock.calls[0] as unknown as Call;
  expect(typeof sent.messages[0].content).toBe("string");
});

it("can't judge without a priced model, or without a one-word answer", async () => {
  expect(await judgeQueued(session(says("steer"), null).s, "a")).toBe(null);
  expect(await judgeQueued(session(says("steer it now")).s, "a")).toBe(null);
  expect(await judgeQueued(session(says("steer", "error")).s, "a")).toBe(null);
  const failed = session(() => Promise.reject(new Error("offline")));
  expect(await judgeQueued(failed.s, "a")).toBe(null);
});
