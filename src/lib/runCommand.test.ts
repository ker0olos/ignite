import { describe, expect, it } from "vitest";
import { isShellBlock, terminalInput } from "./runCommand";

describe("isShellBlock", () => {
  it("is true for shell languages in any case, false otherwise", () => {
    expect(isShellBlock("bash", "a\nb")).toBe(true);
    expect(isShellBlock("ZSH", "ls")).toBe(true);
    expect(isShellBlock("console", "ls")).toBe(false);
    expect(isShellBlock("ts", "f()")).toBe(false);
  });

  it("is true for an untagged block of one line only", () => {
    expect(isShellBlock(undefined, "doppler run -- npx tsx a.ts\n")).toBe(true);
    expect(isShellBlock(undefined, "line one\nline two")).toBe(false);
    expect(isShellBlock(undefined, "  \n")).toBe(false);
  });
});

describe("terminalInput", () => {
  it("enters every line in braces, without blank ones at the end", () => {
    expect(terminalInput("a=1\r\necho $a \\\n  b\n\n")).toBe(
      "{\ra=1\recho $a \\\r  b\r}\r",
    );
  });
});
