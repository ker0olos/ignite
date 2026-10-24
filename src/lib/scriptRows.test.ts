import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import {
  scriptBadge,
  scriptStatus,
  scriptSummary,
  tokenFooter,
} from "./scriptRows";
import type { ToolRun } from "./transcript";

const call = (
  name: string,
  id: string,
  args: Record<string, unknown> = {},
): ToolCall => ({
  type: "toolCall",
  id,
  name,
  arguments: args,
});

describe("scriptStatus", () => {
  it("is running until the script ends, waiting while a call of it waits", () => {
    expect(scriptStatus(undefined, {})).toBe("running");
    const run: ToolRun = { status: "running", nested: [call("bash", "n")] };
    expect(scriptStatus(run, {})).toBe("running");
    expect(scriptStatus(run, { n: { status: "running", approval: {} } })).toBe(
      "waiting",
    );
    expect(scriptStatus({ status: "done" }, {})).toBe("done");
    expect(scriptStatus({ status: "error" }, {})).toBe("failed");
  });
});

describe("scriptSummary", () => {
  const nested = [call("edit", "a"), call("write", "b"), call("bash", "c")];
  const tools: Record<string, ToolRun> = {
    a: { status: "done" },
    b: { status: "error" },
    c: { status: "done" },
  };

  it("counts the calls so far while it runs or waits", () => {
    expect(scriptSummary("running", { status: "running", nested }, tools)).toBe(
      "Running · 3 calls so far",
    );
    expect(
      scriptSummary(
        "waiting",
        { status: "running", nested: [nested[0]] },
        tools,
      ),
    ).toBe("Waiting for you · 1 call so far");
  });

  it("gives the calls and how long they took once done", () => {
    expect(
      scriptSummary(
        "done",
        { status: "done", nested, durationMs: 1830 },
        tools,
      ),
    ).toBe("3 calls · 1.8s");
    expect(scriptSummary("done", { status: "done", nested }, tools)).toBe(
      "3 calls",
    );
  });

  it("says which edits a failed script kept", () => {
    const failed: ToolRun = { status: "error", nested };
    expect(scriptSummary("failed", failed, tools)).toBe(
      "Failed · the 1 edit it made is kept",
    );
    expect(
      scriptSummary("failed", failed, { ...tools, b: { status: "done" } }),
    ).toBe("Failed · the 2 edits it made are kept");
    expect(
      scriptSummary("failed", { status: "error", nested: [nested[2]] }, tools),
    ).toBe("Failed");
  });
});

describe("tokenFooter", () => {
  const run = (seen: number): ToolRun => ({
    status: "done",
    result: { content: [], details: { calls: [], seen } },
  });

  it("compares what the agent was sent with what the calls returned", () => {
    expect(tokenFooter("x".repeat(4800), run(336000))).toBe(
      "Sent the agent 1.2k of 84k tokens",
    );
    expect(tokenFooter("x".repeat(400), run(4000))).toBe(
      "Sent the agent 100 of 1k tokens",
    );
  });

  it("is null when the calls returned nothing", () => {
    expect(tokenFooter("x", run(0))).toBeNull();
    expect(tokenFooter("x", undefined)).toBeNull();
  });
});

describe("scriptBadge", () => {
  it("maps a status to a badge", () => {
    expect(scriptBadge("failed")).toBe("error");
    expect(scriptBadge("done")).toBe("ok");
  });
});
