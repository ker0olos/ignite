import { describe, expect, it } from "vitest";
import { inScratchpad } from "./scratchpad";

describe("inScratchpad", () => {
  const pad = "/var/folders/_z/abc/T/ignite-scratchpad/5ae56415";
  it("is the path inside a scratchpad, else undefined", () => {
    expect(inScratchpad(`${pad}/notes/plan.md`)).toEqual({
      lead: "",
      rest: "notes/plan.md",
    });
    expect(inScratchpad(pad)).toEqual({ lead: "", rest: "" });
    expect(inScratchpad(`${pad}/`)).toEqual({ lead: "", rest: "" });
    expect(inScratchpad("C:\\Temp\\ignite-scratchpad\\5ae\\a.md")).toEqual({
      lead: "",
      rest: "a.md",
    });
    expect(inScratchpad("/var/folders/_z/abc/T/plan.md")).toBeUndefined();
    expect(inScratchpad("/tmp/ignite-scratchpad")).toBeUndefined();
  });

  it("keeps an assignment that leads the path", () => {
    expect(inScratchpad(`D=${pad}/pr789`)).toEqual({
      lead: "D=",
      rest: "pr789",
    });
    expect(inScratchpad(`--out=${pad}/a.log`)).toEqual({
      lead: "--out=",
      rest: "a.log",
    });
  });
});
