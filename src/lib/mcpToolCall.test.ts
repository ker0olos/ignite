import { describe, expect, it } from "vitest";
import { mcpCall } from "./mcpToolCall";

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
