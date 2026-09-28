import { describe, expect, it } from "vitest";
import { revealStep } from "./smoothText";

describe("revealStep", () => {
  it("stays put once everything is shown", () => {
    expect(revealStep(10, 10, 16)).toBe(10);
    expect(revealStep(12, 10, 16)).toBe(10);
  });

  it("reveals a small backlog at the minimum pace", () => {
    expect(revealStep(0, 5, 100)).toBeCloseTo(5);
    expect(revealStep(0, 10, 20)).toBeCloseTo(4);
  });

  it("drains a burst over the catch-up time, never overshooting", () => {
    expect(revealStep(0, 1000, 48)).toBeCloseTo(500);
    expect(revealStep(0, 1000, 5000)).toBe(1000);
  });
});
