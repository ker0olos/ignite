import { describe, expect, it } from "vitest";
import { effortColor, nearestStep, resist } from "./effortSlider";

describe("nearestStep", () => {
  it("rounds to the closest level and clamps past the ends", () => {
    expect(nearestStep(0, 100, 5)).toBe(0);
    expect(nearestStep(37, 100, 5)).toBe(1);
    expect(nearestStep(38, 100, 5)).toBe(2);
    expect(nearestStep(-40, 100, 5)).toBe(0);
    expect(nearestStep(180, 100, 5)).toBe(4);
  });
});

describe("resist", () => {
  it("sits exactly on a level", () => {
    expect(resist(50, 100, 3)).toBe(50);
  });

  it("holds the thumb back toward the nearest level", () => {
    const shown = resist(60, 100, 3);
    expect(shown).toBeGreaterThan(50);
    expect(shown).toBeLessThan(60);
  });

  it("snaps over once past halfway between levels", () => {
    expect(resist(24, 100, 3)).toBeLessThan(12);
    expect(resist(26, 100, 3)).toBeGreaterThan(38);
  });

  it("stretches only a little past either end", () => {
    expect(resist(-1000, 100, 3)).toBeGreaterThan(-10);
    expect(resist(-5, 100, 3)).toBeLessThan(0);
    expect(resist(1100, 100, 3)).toBeLessThan(110);
    expect(resist(105, 100, 3)).toBeGreaterThan(100);
  });
});

describe("effortColor", () => {
  it("runs from green to red and clamps", () => {
    expect(effortColor(0)).toBe("oklch(0.72 0.17 145.0)");
    expect(effortColor(1)).toBe("oklch(0.72 0.17 25.0)");
    expect(effortColor(-1)).toBe(effortColor(0));
    expect(effortColor(2)).toBe(effortColor(1));
  });
});
