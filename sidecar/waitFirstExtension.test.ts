import { describe, expect, it } from "vitest";
import { waitBefore } from "./waitFirstExtension.ts";

const bash = (id: string, command: string) => ({
  type: "toolCall",
  id,
  name: "bash",
  arguments: { command },
});
const gh = { type: "toolCall", id: "g", name: "gh", arguments: {} };

describe("waitBefore", () => {
  it("names a sleep sent before the call", () => {
    const calls = [{ type: "text" }, bash("s", "sleep 100"), gh];
    expect(waitBefore(calls, "g")).toBe("sleep 100");
  });

  it("counts a sleep that starts a command", () => {
    expect(waitBefore([bash("s", "sleep 5 && ls"), gh], "g")).toBe(
      "sleep 5 && ls",
    );
  });

  it("leaves the sleep itself and calls before it alone", () => {
    const calls = [gh, bash("s", "sleep 1")];
    expect(waitBefore(calls, "s")).toBeUndefined();
    expect(waitBefore(calls, "g")).toBeUndefined();
  });

  it("leaves batches without a wait alone", () => {
    const calls = [bash("a", "npm test"), bash("b", "echo sleep 1"), gh];
    expect(waitBefore(calls, "g")).toBeUndefined();
  });

  it("ignores a call from another message", () => {
    expect(waitBefore([bash("s", "sleep 1")], "g")).toBeUndefined();
  });
});
