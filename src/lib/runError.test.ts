import { describe, expect, it } from "vitest";
import { runError, shownError } from "./runError";

describe("runError", () => {
  it("drops claude-bridge's prefix from a limit, colons in its reset time too", () => {
    expect(
      runError(
        "Claude quota exceeded — rate limit (five_hour) — resets 12:50:00 AM: You've hit your session limit · resets 12:50am (Africa/Cairo)",
      ),
    ).toBe("You've hit your session limit · resets 12:50am (Africa/Cairo)");
  });

  it("keeps other errors as they are, and none as empty", () => {
    expect(runError("400 bad request")).toBe("400 bad request");
    expect(runError()).toBe("");
  });
});

describe("shownError", () => {
  it("is a failed reply's short error, never a long, empty or aborted one", () => {
    expect(shownError({ stopReason: "error", errorMessage: "boom" })).toBe(
      "boom",
    );
    expect(
      shownError({ stopReason: "error", errorMessage: "x".repeat(161) }),
    ).toBeUndefined();
    expect(shownError({ stopReason: "error" })).toBeUndefined();
    expect(
      shownError({ stopReason: "aborted", errorMessage: "boom" }),
    ).toBeUndefined();
  });
});
