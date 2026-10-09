// @vitest-environment node
import {
  createEventBus,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import { DECLINED_ADD, registerTaskAdd } from "./taskAddTool.ts";
import { TASK_EVENT, type TaskAsk } from "./taskExtension.ts";

const WROTE = "The user wrote instead.";

function load(approved: boolean | string, answered = true) {
  const events = createEventBus();
  let tool: ToolDefinition | undefined;
  registerTaskAdd({
    registerTool: (t: ToolDefinition) => (tool = t),
    events,
  } as unknown as ExtensionAPI);
  const asked: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => {
    asked.push(data as ApprovalAsk);
    (data as ApprovalAsk).answer(
      approved === true,
      undefined,
      undefined,
      typeof approved === "string" ? approved : undefined,
    );
  });
  const added: TaskAsk[] = [];
  if (answered) {
    events.on(TASK_EVENT, (data) => {
      const ask = data as TaskAsk;
      added.push(ask);
      ask.heard = true;
      ask.reply(ask.kind === "add" ? ask.tasks[0] : null);
    });
  }
  const run = (params: object) =>
    tool!.execute("c1", params as never, undefined, undefined, {} as never);
  return { asked, added, run };
}

const text = (r: { content: { type: string; text?: string }[] }) =>
  r.content[0].text;

describe("task_add", () => {
  it("adds the tasks unstarted once the user approves", async () => {
    const { asked, added, run } = load(true);
    const result = await run({
      tasks: [{ title: " Bug 1 ", notes: "link", subtasks: ["a", " "] }],
    });
    expect(asked[0].request.toolCallId).toBe("c1");
    const ask = added[0] as Extract<TaskAsk, { kind: "add" }>;
    expect(ask.tasks[0]).toMatchObject({
      title: "Bug 1",
      notes: "link",
      subtasks: [{ title: "a", status: "todo" }],
    });
    expect(ask.tasks[0].session).toBeUndefined();
    expect(text(result)).toBe("Added 1 task(s) to the list: Bug 1");
  });

  it("adds nothing when the user declines", async () => {
    const { added, run } = load(false);
    const result = await run({ tasks: [{ title: "Bug 1" }] });
    expect(added).toEqual([]);
    expect(text(result)).toBe(DECLINED_ADD);
  });

  it("tells the model the host's reason for denying it", async () => {
    const { added, run } = load(WROTE);
    const result = await run({ tasks: [{ title: "Bug 1" }] });
    expect(added).toEqual([]);
    expect(text(result)).toBe(WROTE);
  });

  it("fails when nobody saves them", async () => {
    const { run } = load(true, false);
    await expect(run({ tasks: [{ title: "Bug 1" }] })).rejects.toThrow(
      "couldn't be saved",
    );
  });
});
