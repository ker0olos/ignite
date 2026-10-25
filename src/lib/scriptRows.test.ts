import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import {
  outputLabel,
  scriptBadge,
  scriptEnd,
  scriptOutput,
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

  it("is null when the script passed on all its calls returned, or more", () => {
    expect(tokenFooter("x".repeat(200), run(140))).toBeNull();
    expect(tokenFooter("x".repeat(140), run(140))).toBeNull();
  });
});

describe("scriptOutput", () => {
  it("drops pi's header, completed or failed", () => {
    expect(
      scriptOutput(
        "Script completed\nWall time 226.8 seconds\nOutput:\n\nfil: OK",
      ),
    ).toBe("fil: OK");
    expect(
      scriptOutput(
        "Script failed\nWall time 0.1 seconds\nOutput:\n\nScript error:\nboom",
      ),
    ).toBe("Script error:\nboom");
  });

  it("keeps text without the header, and the header's words elsewhere", () => {
    expect(scriptOutput("Refused: no // why line")).toBe(
      "Refused: no // why line",
    );
    const quoted = "a\nScript completed\nWall time 1 seconds\nOutput:\n";
    expect(scriptOutput(quoted)).toBe(quoted);
  });
});

describe("scriptEnd", () => {
  it("ends on Done, or on Failed only with an error to show", () => {
    expect(scriptEnd("done", "")).toBe("done");
    expect(scriptEnd("failed", "Script error: boom")).toBe("failed");
    expect(scriptEnd("failed", "")).toBeNull();
    expect(scriptEnd("running", "x")).toBeNull();
  });
});

describe("outputLabel", () => {
  it("counts the lines, not trailing newlines", () => {
    expect(outputLabel("done\n")).toBe("Output \u00b7 1 line");
    expect(outputLabel("a\nb\nc")).toBe("Output \u00b7 3 lines");
    expect(outputLabel("Script error:\nboom", "Error")).toBe(
      "Error \u00b7 2 lines",
    );
  });
});

describe("scriptBadge", () => {
  it("maps a status to a badge", () => {
    expect(scriptBadge("failed")).toBe("error");
    expect(scriptBadge("done")).toBe("ok");
  });
});
