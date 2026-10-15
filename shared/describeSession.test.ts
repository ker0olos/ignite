import { describe, expect, it } from "vitest";
import type { AgentMessage } from "./agentTypes.ts";
import { describeSession } from "./describeSession.ts";

const user = (content: string): AgentMessage => ({
  role: "user",
  content,
  timestamp: 1,
});
const reply = (...content: unknown[]) =>
  ({ role: "assistant", content }) as unknown as AgentMessage;
const call = (name: string, path?: string) => ({
  type: "toolCall",
  id: name,
  name,
  arguments: path ? { path } : {},
});
const text = (t: string) => ({ type: "text", text: t });
const plan = (titles: string[]) =>
  ({
    role: "toolResult",
    toolName: "task_update",
    content: [],
    details: { subtasks: titles.map((title) => ({ title, status: "todo" })) },
  }) as unknown as AgentMessage;

describe("describeSession", () => {
  it("folds each run of replies into one: its last text, tool calls and edited files", () => {
    const { recent } = describeSession([
      user("Fix it"),
      reply(text("Looking."), call("read", "a.ts"), call("edit", "a.ts")),
      { role: "toolResult", toolName: "edit", content: [] } as AgentMessage,
      reply(call("edit", "a.ts"), call("write", "b.ts")),
      reply(text("  Fixed a.ts. ")),
    ]);
    expect(recent).toEqual([
      { role: "user", text: "Fix it" },
      {
        role: "assistant",
        text: "Fixed a.ts.",
        tools: 4,
        edits: 2,
      },
    ]);
  });

  it("keeps the last four messages, with a skill shown as typed", () => {
    const { recent } = describeSession([
      user("one"),
      reply(text("1")),
      user("two"),
      reply(text("2")),
      user('<skill name="review" location="/s">\nbody\n</skill>\n\nplease'),
      reply(text("3")),
    ]);
    expect(recent.map((r) => r.text)).toEqual([
      "two",
      "2",
      "/review please",
      "3",
    ]);
  });

  it("leaves out empty messages and replies", () => {
    expect(
      describeSession([user("  "), reply(text("")), user("hi")]).recent,
    ).toEqual([{ role: "user", text: "hi" }]);
  });

  it("keeps an image-only message between the replies around it", () => {
    const image = {
      role: "user",
      content: [{ type: "image", data: "", mimeType: "image/png" }],
      timestamp: 1,
    } as AgentMessage;
    const { recent } = describeSession([
      reply(text("before"), call("read")),
      image,
      reply(text("after")),
    ]);
    expect(recent.map((r) => r.text)).toEqual(["before", "Image", "after"]);
  });

  it("takes the latest plan, even an emptied one", () => {
    expect(describeSession([plan(["a"]), plan([])]).subtasks).toEqual([]);
  });

  it("takes the latest reported plan", () => {
    const { subtasks } = describeSession([
      plan(["a"]),
      plan(["b", "c"]),
      {
        role: "toolResult",
        toolName: "task_update",
        content: [],
      } as unknown as AgentMessage,
    ]);
    expect(subtasks.map((s) => s.title)).toEqual(["b", "c"]);
  });

  it("shortens long messages", () => {
    const { recent } = describeSession([user("x".repeat(900))]);
    expect(recent[0].text).toHaveLength(400);
  });
});
