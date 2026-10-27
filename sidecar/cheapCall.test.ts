// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { askCheapest, askModel } from "./cheapCall.ts";

const model = (id: string, output?: number) =>
  ({
    provider: "anthropic",
    id,
    cost: output ? { output } : undefined,
  }) as never;
const MODELS = [model("opus", 25), model("haiku", 5)];

let lines: string[] = [];
beforeEach(() => {
  lines = [];
  vi.spyOn(process.stderr, "write").mockImplementation((line) => {
    lines.push(String(line));
    return true;
  });
});
afterEach(() => vi.restoreAllMocks());
const logged = () => lines;

const session = (
  completeSimple: (...a: unknown[]) => Promise<unknown>,
  models = MODELS,
) =>
  ({
    model: models[0],
    modelRuntime: {
      completeSimple: vi.fn(completeSimple),
      getModels: () => models,
      getAvailable: async () => models,
    },
  }) as never;
const says =
  (stopReason: string, text = "", errorMessage?: string) =>
  async () => ({
    stopReason,
    errorMessage,
    content: [{ type: "thinking" }, { type: "text", text }],
  });
const opts = { label: "reflector", timeoutMs: 1_000 };

it("returns the reply's text from the cheapest model, uncached", async () => {
  const s = session(says("stop", "points"));
  expect(await askCheapest(s, "prompt", "input", opts)).toBe("points");
  const [picked, , options] = (
    s as unknown as {
      modelRuntime: { completeSimple: ReturnType<typeof vi.fn> };
    }
  ).modelRuntime.completeSimple.mock.calls[0] as [
    { id: string },
    unknown,
    { cacheRetention: string },
  ];
  expect(picked.id).toBe("haiku");
  expect(options.cacheRetention).toBe("none");
  expect(logged()).toEqual([]);
});

it("logs a call that threw, errored or was cut off under its label, and returns null", async () => {
  const thrown = session(() => Promise.reject(new Error("offline")));
  expect(await askModel(thrown, MODELS[1]!, "p", "c", opts)).toBeNull();
  const refused = session(says("error", "", "credit balance is too low"));
  expect(await askModel(refused, MODELS[1]!, "p", "c", opts)).toBeNull();
  const cut = session(says("length", '{"points": ['));
  expect(await askModel(cut, MODELS[1]!, "p", "c", opts)).toBeNull();
  expect(logged()).toEqual([
    expect.stringMatching(/^pi-host: reflector failed: Error: offline /),
    expect.stringMatching(
      /reflector failed: error: credit balance is too low /,
    ),
    expect.stringMatching(/reflector failed: length /),
  ]);
});

it("says a call timed out, and logs nothing when its caller stopped it", async () => {
  const hangs = (_m: unknown, _c: unknown, o: unknown) =>
    new Promise((resolve) =>
      (o as { signal: AbortSignal }).signal.addEventListener("abort", () =>
        resolve({ stopReason: "aborted", content: [] }),
      ),
    );
  expect(
    await askModel(session(hangs), MODELS[1]!, "p", "c", {
      ...opts,
      timeoutMs: 10,
    }),
  ).toBeNull();
  expect(logged()).toEqual([
    expect.stringMatching(/reflector failed: timed out/),
  ]);
  const stop = new AbortController();
  const asked = askModel(session(hangs), MODELS[1]!, "p", "c", {
    ...opts,
    signal: stop.signal,
  });
  stop.abort();
  expect(await asked).toBeNull();
  expect(logged()).toHaveLength(1);
});

it("returns null without a call where no model lists a price, quietly; logs a lookup that threw", async () => {
  const unpriced = session(says("stop", "x"), [model("a"), model("b")]);
  expect(await askCheapest(unpriced, "p", "c", opts)).toBeNull();
  expect(logged()).toEqual([]);
  const broken = {
    model: MODELS[0],
    modelRuntime: {
      getModels: () => MODELS,
      getAvailable: () => Promise.reject(new Error("auth refresh")),
    },
  } as never;
  expect(await askCheapest(broken, "p", "c", opts)).toBeNull();
  expect(logged()).toEqual([
    expect.stringMatching(/reflector failed: Error: auth refresh/),
  ]);
});
