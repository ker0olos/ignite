import { describe, expect, it } from "vitest";
import { format } from "../src/timer";

describe("format", () => {
  it("pads minutes and seconds", () => {
    expect(format(65)).toBe("01:05");
  });

  it("shows a full session", () => {
    expect(format(25 * 60)).toBe("25:00");
  });
});
