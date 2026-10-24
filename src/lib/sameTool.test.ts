import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import { sameToolRuns } from "./sameTool";
import type { Row } from "./toolRows";

let n = 0;
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  type: "toolCall",
  id: `c${++n}`,
  name,
  arguments: args,
});
const tool = (c: ToolCall): Row => ({ kind: "tool", call: c });
const text: Row = { kind: "text", text: "and then" };

describe("sameToolRuns", () => {
  it("puts consecutive calls of one tool under one row, keeping every call", () => {
    const [a, b, c] = [call("git"), call("git"), call("git")];
    expect(sameToolRuns([tool(a), tool(b), tool(c)])).toEqual([
      { kind: "calls", calls: [a, b, c] },
    ]);
  });

  it("puts consecutive reads, searches and listings under one row", () => {
    const [a, b, c, d] = [call("grep"), call("ls"), call("read"), call("bash")];
    expect(sameToolRuns([tool(a), tool(b), tool(c), tool(d)])).toEqual([
      { kind: "calls", calls: [a, b, c] },
      tool(d),
    ]);
  });

  it("starts again after other tools and text", () => {
    const [a, b, c, d] = [call("git"), call("read"), call("read"), call("git")];
    expect(sameToolRuns([tool(a), tool(b), text, tool(c), tool(d)])).toEqual([
      tool(a),
      tool(b),
      text,
      tool(c),
      tool(d),
    ]);
  });

  it("tells background commands from others, and groups one MCP server's tools", () => {
    const [bg, fg] = [call("bash", { background: true }), call("bash")];
    expect(sameToolRuns([tool(bg), tool(fg)])).toEqual([tool(bg), tool(fg)]);
    const issues = call("mcp__github", { tool: "list_issues" });
    const comment = call("mcp__github__add_comment");
    const sentry = call("mcp__sentry", { tool: "get_issue" });
    expect(sameToolRuns([tool(issues), tool(comment), tool(sentry)])).toEqual([
      { kind: "calls", calls: [issues, comment] },
      tool(sentry),
    ]);
  });

  it("leaves tools with cards of their own, and MCP searches, a row each", () => {
    const rows = [
      tool(call("ask_user")),
      tool(call("ask_user")),
      tool(call("codemode")),
      tool(call("codemode")),
      tool(call("mcp", { search: "issues" })),
      tool(call("mcp", { search: "pulls" })),
    ];
    expect(sameToolRuns(rows)).toEqual(rows);
  });
});
