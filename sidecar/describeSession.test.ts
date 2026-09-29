// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { describeSession } from "./describeSession.ts";

const reply = (content: unknown[], cost?: number, model = "claude-opus-5-5") =>
  ({
    role: "assistant",
    model,
    content,
    ...(cost !== undefined && { usage: { cost: { total: cost } } }),
  }) as unknown as AgentMessage;
const call = (name: string, path?: string) => ({
  type: "toolCall",
  id: name,
  name,
  arguments: path ? { path } : {},
});

describe("describeSession", () => {
  it("tells its model, last reply, files edited (from the folder), tool calls and cost", () => {
    const worktree = "/Users/me/.ignition/worktrees/app-1a2b/s1";
    const details = describeSession(
      [
        { role: "user", content: "Fix it", timestamp: 1 },
        reply(
          [call("read", "a.ts"), call("edit", `${worktree}/src/a.ts`)],
          0.25,
        ),
        reply(
          [
            call("write", "notes.md"),
            call("edit", `${worktree}/src/a.ts`),
            call("edit", "/Users/me/app/lib/b.ts"),
            call("edit", "/elsewhere/c.ts"),
          ],
          0.5,
        ),
        reply([{ type: "text", text: "  Done: fixed a.ts. " }], 0.25, "gpt-5"),
      ],
      "/Users/me/app",
    );
    expect(details).toEqual({
      model: "gpt-5",
      lastReply: "Done: fixed a.ts.",
      files: ["/elsewhere/c.ts", "lib/b.ts", "src/a.ts", "notes.md"],
      toolCalls: 6,
      cost: 1,
    });
  });

  it("says little about a conversation with no reply yet", () => {
    expect(
      describeSession([{ role: "user", content: "Hi", timestamp: 1 }], "/app"),
    ).toEqual({ files: [], toolCalls: 0 });
  });

  it("shortens a long last reply", () => {
    const long = describeSession(
      [reply([{ type: "text", text: "x".repeat(900) }])],
      "/app",
    );
    expect(long.lastReply).toHaveLength(400);
  });
});
