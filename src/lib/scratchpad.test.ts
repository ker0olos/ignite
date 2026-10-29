import { describe, expect, it } from "vitest";
import { inScratchpad } from "./scratchpad";

describe("inScratchpad", () => {
  const pad = "/var/folders/_z/abc/T/ignite-scratchpad/5ae56415";
  it("is the path inside a scratchpad, else undefined", () => {
    expect(inScratchpad(`${pad}/notes/plan.md`)).toBe("notes/plan.md");
    expect(inScratchpad(pad)).toBe(".");
    expect(inScratchpad(`${pad}/`)).toBe(".");
    expect(inScratchpad("C:\\Temp\\ignite-scratchpad\\5ae\\a.md")).toBe("a.md");
    expect(inScratchpad("/var/folders/_z/abc/T/plan.md")).toBeUndefined();
    expect(inScratchpad("/tmp/ignite-scratchpad")).toBeUndefined();
  });
});
