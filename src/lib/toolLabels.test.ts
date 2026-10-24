import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import {
  callReason,
  groupBadge,
  groupCount,
  mcpArg,
  mcpTitle,
  toolBadge,
} from "./toolLabels";

const call = (args: Record<string, unknown>): ToolCall => ({
  type: "toolCall",
  id: "1",
  name: "bash",
  arguments: args,
});

describe("groupCount", () => {
  it("counts shell, git and gh calls as commands, others as calls", () => {
    const named = (name: string) => ({ ...call({}), name });
    expect(groupCount([named("git"), named("git")])).toBe("2 commands");
    expect(groupCount([named("bash")])).toBe("1 command");
    expect(groupCount([named("read"), named("read")])).toBe("2 calls");
  });
});

describe("groupBadge", () => {
  it("shows waiting first, then running, then failed, else nothing", () => {
    const done = { status: "done" as const };
    const failed = { status: "error" as const };
    const running = { status: "running" as const };
    const waiting = { status: "running" as const, approval: {} };
    expect(groupBadge([done, failed, running, waiting])).toBe("waiting");
    expect(groupBadge([failed, running])).toBe("running");
    expect(groupBadge([done, failed])).toBe("error");
    expect(groupBadge([done, done])).toBeNull();
  });
});

describe("mcpTitle", () => {
  it("humanizes a tool name", () => {
    expect(mcpTitle("get_issue")).toBe("Get issue");
    expect(mcpTitle("list_pull_requests")).toBe("List pull requests");
    expect(mcpTitle("searchIssues")).toBe("Search issues");
    expect(mcpTitle("create-issue")).toBe("Create issue");
  });
});

describe("mcpArg", () => {
  it("shows the tool's arguments on a line, a string as is", () => {
    expect(mcpArg({ kind: "call", tool: "t", args: { id: "A-1", n: 2 } })).toBe(
      "id: A-1, n: 2",
    );
    expect(mcpArg({ kind: "call", tool: "t", args: "A-1" })).toBe("A-1");
    expect(mcpArg({ kind: "call", tool: "t", args: undefined })).toBe("");
  });
});

describe("callReason", () => {
  it("is the agent's reason, or nothing", () => {
    expect(callReason(call({ reason: " Check it " }))).toBe("Check it");
    expect(callReason(call({}))).toBe("");
    expect(callReason(call({ reason: 3 }))).toBe("");
  });
});

describe("toolBadge", () => {
  it("shows a running, waiting or failed call, and none once done", () => {
    expect(toolBadge(undefined)).toBe("running");
    expect(toolBadge({ status: "running" })).toBe("running");
    expect(toolBadge({ status: "running", approval: {} })).toBe("waiting");
    expect(toolBadge({ status: "error" })).toBe("error");
    expect(toolBadge({ status: "done" })).toBeNull();
  });
});
