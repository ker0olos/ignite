// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../shared/tasks.ts";
import type { Agent } from "./hostTypes.ts";
import { routeMessage } from "./hostRoute.ts";
import type { Route } from "./router.ts";

vi.mock("./router.ts", () => ({
  route: vi.fn(),
  modelRouterOn: vi.fn(async () => true),
}));
const router = await import("./router.ts");
vi.mock("./hostProjects.ts", () => ({ pushProjects: vi.fn() }));
const { pushProjects } = await import("./hostProjects.ts");

const BIG = { provider: "p", id: "big", name: "Big" } as never;
const OWN = { provider: "p", id: "own", name: "Own" };
const routed: Route = { model: BIG, effort: "low" };

const task = (over: Partial<Task>): Task => ({
  id: "t",
  title: "T",
  notes: "",
  images: [],
  subtasks: [],
  created: 0,
  updated: 0,
  ...over,
});

function setup(tasks: Task[] = [], shown = true) {
  const agent = { id: "s1", cwd: "/f", title: "" } as Agent;
  const ctx = {
    shown: shown ? "s1" : null,
    agents: new Map([["s1", agent]]),
    send: vi.fn(),
    tasks: { list: async () => tasks },
  };
  const s = {
    messages: [] as unknown[],
    modelRuntime: { getAvailable: async () => [BIG, OWN] },
    model: OWN as unknown,
    thinkingLevel: "high",
    setModel: vi.fn(async (m: unknown) => {
      s.model = m;
    }),
    setThinkingLevel: vi.fn((level: string) => {
      s.thinkingLevel = level;
    }),
  };
  const run = () =>
    routeMessage(ctx as never, agent, s as never, "Add dark mode\nplease");
  return { ctx, s, agent, run };
}

const events = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.map(([m]) => m.event);

describe("routeMessage", () => {
  it("picks the first message's model and effort, without saving them as defaults", async () => {
    vi.mocked(router.route).mockResolvedValueOnce(routed);
    const { ctx, s, agent, run } = setup();
    expect(await run()).toBe(true);
    expect(s.setModel).toHaveBeenCalledWith(BIG, { persist: false });
    expect(s.setThinkingLevel).toHaveBeenCalledWith("low", { persist: false });
    expect(agent.title).toBe("Add dark mode");
    expect(events(ctx.send)).toEqual([
      {
        type: "routing_start",
        message: expect.objectContaining({ content: "Add dark mode\nplease" }),
      },
      {
        type: "routing_end",
        sent: true,
        picked: { model: BIG, effort: "low", kept: false },
      },
    ]);
  });

  it("keeps the user's default when the router has no answer, and says so", async () => {
    vi.mocked(router.route).mockResolvedValueOnce(null);
    const { ctx, s, run } = setup();
    await run();
    expect(s.setModel).not.toHaveBeenCalled();
    expect(events(ctx.send).at(-1)).toEqual({
      type: "routing_end",
      sent: true,
      picked: { model: OWN, effort: "high", kept: true },
    });
  });

  it("puts back the model it switched to when Stop lands during the switch", async () => {
    vi.mocked(router.route).mockResolvedValueOnce(routed);
    const { agent, s, run } = setup();
    s.setModel.mockImplementationOnce(async (m: unknown) => {
      s.model = m;
      agent.routing!.controller.abort();
    });
    expect(await run()).toBe(false);
    expect(s.model).toBe(OWN);
    expect(s.thinkingLevel).toBe("high");
  });

  it("keeps a title it didn't set when Stop drops the message", async () => {
    vi.mocked(router.route).mockImplementationOnce(async () => {
      agent.routing!.controller.abort();
      return null;
    });
    const { agent, run } = setup();
    agent.title = "Named";
    expect(await run()).toBe(false);
    expect(agent.title).toBe("Named");
    expect(agent.routing).toBeUndefined();
  });

  it("leaves later messages alone, keeping the conversation's model", async () => {
    vi.mocked(router.route).mockClear();
    const { ctx, s, run } = setup();
    s.messages.push({ role: "user", content: "earlier" });
    expect(await run()).toBe(true);
    expect(router.route).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it("does nothing with Model Router off, a picked model, or a task's own model", async () => {
    vi.mocked(router.route).mockClear();
    vi.mocked(router.modelRouterOn).mockResolvedValueOnce(false);
    expect(await setup().run()).toBe(true);
    const picked = setup();
    picked.agent.pickedModel = true;
    expect(await picked.run()).toBe(true);
    const own = task({ session: "s1", model: { provider: "p", id: "own" } });
    const withModel = setup([own]);
    expect(await withModel.run()).toBe(true);
    expect(router.route).not.toHaveBeenCalled();
    expect(withModel.agent.routing).toBeUndefined();
  });

  it("routes a task with no model, or one no longer available, picking both", async () => {
    vi.mocked(router.route).mockResolvedValue(routed);
    const effortOnly = setup([task({ session: "s1", effort: "max" })]);
    await effortOnly.run();
    expect(effortOnly.s.thinkingLevel).toBe("low");
    const gone = task({ session: "s1", model: { provider: "p", id: "gone" } });
    const { s, run } = setup([gone]);
    await run();
    expect(s.setModel).toHaveBeenCalledWith(BIG, { persist: false });
    vi.mocked(router.route).mockReset();
  });

  it("routes a composer conversation that already joined the task list", async () => {
    vi.mocked(router.route).mockResolvedValueOnce(null);
    await setup([task({ session: "s1", interactive: true })]).run();
    expect(router.route).toHaveBeenCalled();
  });

  it("tells only a shown conversation's app that it's routing", async () => {
    vi.mocked(router.route).mockResolvedValueOnce(null);
    const { ctx, run } = setup([], false);
    await run();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it("refuses a second message while the first is routed, and Stop drops the first", async () => {
    let answer!: (r: Route | null) => void;
    vi.mocked(router.route).mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { ctx, agent, s, run } = setup();
    const first = run();
    await vi.waitFor(() => expect(answer).toBeDefined());
    await expect(run()).rejects.toThrow("still being read");
    expect(agent.routing?.text).toBe("Add dark mode\nplease");
    agent.routing!.controller.abort();
    answer(routed);
    expect(await first).toBe(false);
    expect(agent.routing).toBeUndefined();
    expect(agent.title).toBe("");
    expect(s.setModel).not.toHaveBeenCalled();
    expect(events(ctx.send).at(-1)).toEqual({
      type: "routing_end",
      sent: false,
    });
    expect(pushProjects).toHaveBeenCalled();
  });

  it("holds a second message even while it checks whether to route", async () => {
    let settled!: (on: boolean) => void;
    vi.mocked(router.modelRouterOn).mockImplementationOnce(
      () => new Promise((resolve) => (settled = resolve)),
    );
    const { run } = setup();
    const first = run();
    await expect(run()).rejects.toThrow("still being read");
    settled(false);
    expect(await first).toBe(true);
  });

  it("sends the message as it is when the router or the model change fails", async () => {
    vi.mocked(router.route).mockRejectedValueOnce(new Error("down"));
    expect(await setup().run()).toBe(true);
    vi.mocked(router.route).mockResolvedValueOnce(routed);
    const { s, run } = setup();
    s.setModel.mockRejectedValueOnce(new Error("no auth"));
    expect(await run()).toBe(true);
  });
});
