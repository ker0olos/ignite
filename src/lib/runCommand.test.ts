import { describe, expect, it } from "vitest";
import { isShellBlock, terminalInput } from "./runCommand";

describe("isShellBlock", () => {
  it("is true for shell languages in any case, false otherwise", () => {
    expect(isShellBlock("bash")).toBe(true);
    expect(isShellBlock("ZSH")).toBe(true);
    expect(isShellBlock("console")).toBe(false);
    expect(isShellBlock("ts")).toBe(false);
    expect(isShellBlock(undefined)).toBe(false);
  });
});

describe("terminalInput", () => {
  it("enters every line in braces, without blank ones at the end", () => {
    expect(terminalInput("a=1\r\necho $a \\\n  b\n\n")).toBe(
      "{\ra=1\recho $a \\\r  b\r}\r",
    );
  });
});
