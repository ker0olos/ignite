import { describe, expect, it } from "vitest";
import { approvalArgs, argsText, mcpCall } from "./mcpToolCall";

describe("approvalArgs", () => {
  it("shows an MCP call's arguments, multi-line strings as blocks", () => {
    expect(
      approvalArgs("mcp__supabase", {
        tool: "execute_sql",
        args: { project_id: "abc", query: "delete from users\nwhere id = 1" },
        reason: "Removes the test user",
      }),
    ).toEqual({
      code: "project_id: abc\nquery: |\n  delete from users\n  where id = 1",
      lang: "yaml",
    });
  });

  it("keeps the server tool's own reason, and shows nothing with no arguments", () => {
    expect(
      approvalArgs("mcp", {
        tool: "refund",
        args: { reason: "fraudulent" },
        reason: "Why",
      }),
    ).toEqual({ code: "reason: fraudulent", lang: "yaml" });
    expect(approvalArgs("mcp", { tool: "list_projects" })).toBeNull();
  });

  it("shows a script's code", () => {
    expect(approvalArgs("mcpScript", { code: "emit(1)" })).toEqual({
      code: "emit(1)",
      lang: "js",
    });
  });

  it("shows other tools' arguments without the reason, values as JSON", () => {
    expect(
      approvalArgs("supabase_execute_sql", { limit: 2, reason: "Why" }),
    ).toEqual({ code: "limit: 2", lang: "yaml" });
  });

  it("shows nothing when the row already does, or there are no arguments", () => {
    expect(approvalArgs("write", { path: "/x", content: "y" })).toBeNull();
    expect(approvalArgs("mcp", { search: "sql" })).toBeNull();
    expect(approvalArgs("chrome_tabs", { reason: "Why" })).toBeNull();
  });

  it("shows arguments that aren't an object as they are", () => {
    expect(argsText("raw")).toBe("raw");
    expect(argsText([1])).toBe("[\n  1\n]");
  });
});

describe("mcpCall", () => {
  it("ignores other tools", () => {
    expect(mcpCall("bash", { command: "ls" })).toBeNull();
    expect(mcpCall("mcpx", {})).toBeNull();
  });

  it("reads a call through a server's own tool", () => {
    expect(
      mcpCall("mcp__github", { tool: "list_issues", args: { repo: "a/b" } }),
    ).toEqual({
      kind: "call",
      server: "github",
      tool: "list_issues",
      args: { repo: "a/b" },
    });
  });

  it("reads a call through the mcp tool, with or without a server", () => {
    expect(
      mcpCall("mcp", { tool: "github_list_issues", server: "github" }),
    ).toEqual({
      kind: "call",
      server: "github",
      tool: "github_list_issues",
      args: {},
    });
    expect(mcpCall("mcp", { tool: "github_list_issues" })).toEqual({
      kind: "call",
      server: undefined,
      tool: "github_list_issues",
      args: {},
    });
  });

  it("parses arguments sent as a JSON string, and keeps any other string", () => {
    expect(mcpCall("mcp", { tool: "t", args: '{"a":1}' })).toMatchObject({
      args: { a: 1 },
    });
    expect(mcpCall("mcp", { tool: "t", args: "{oops" })).toMatchObject({
      args: "{oops",
    });
  });

  it("reads searches, lookups and connections", () => {
    expect(mcpCall("mcp", { search: "screenshot" })).toEqual({
      kind: "search",
      query: "screenshot",
    });
    expect(mcpCall("mcp", { describe: "github_list_issues" })).toEqual({
      kind: "describe",
      tool: "github_list_issues",
    });
    expect(mcpCall("mcp", { connect: "github" })).toEqual({
      kind: "connect",
      server: "github",
    });
  });

  it("reads scripts", () => {
    expect(mcpCall("mcpScript", { code: "emit(1)" })).toEqual({
      kind: "script",
      code: "emit(1)",
    });
    expect(mcpCall("mcpScript", {})).toEqual({ kind: "script", code: "" });
  });

  it("treats anything else as housekeeping", () => {
    expect(mcpCall("mcp", {})).toEqual({ kind: "other" });
    expect(mcpCall("mcp", { tool: 3 })).toEqual({
      kind: "call",
      server: undefined,
      tool: "",
      args: {},
    });
  });
});
