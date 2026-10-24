import { describe, expect, it } from "vitest";
import { scriptReason } from "./codemode.ts";

describe("scriptReason", () => {
  it("is the script's first comment line, after an options line", () => {
    expect(scriptReason("// Find runOn's callers\nreturn 1;")).toBe(
      "Find runOn's callers",
    );
    expect(
      scriptReason(
        '\n  // @options: {"timeout_ms": 60000}\n//  Check the tests  \nreturn 1;',
      ),
    ).toBe("Check the tests");
  });

  it("is empty without one", () => {
    expect(scriptReason("return 1; // late")).toBe("");
    expect(scriptReason("// @options: {}\nreturn 1;")).toBe("");
    expect(scriptReason("//   \nreturn 1;")).toBe("");
    expect(scriptReason(undefined)).toBe("");
  });
});
