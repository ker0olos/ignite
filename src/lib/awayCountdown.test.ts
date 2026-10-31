import { describe, expect, it } from "vitest";
import { awayCountdown } from "@/lib/awayCountdown";

describe("awayCountdown", () => {
  const now = 1_000_000;

  it("counts down once under 4 minutes are left, rounding up", () => {
    expect(awayCountdown(now + 4 * 60_000, now)).toBe("4:00");
    expect(awayCountdown(now + 61_500, now)).toBe("1:02");
    expect(awayCountdown(now + 1, now)).toBe("0:01");
  });

  it("shows nothing while the user was just here, once time is up, or for a call that waits forever", () => {
    expect(awayCountdown(now + 4 * 60_000 + 1, now)).toBeUndefined();
    expect(awayCountdown(now, now)).toBeUndefined();
    expect(awayCountdown(undefined, now)).toBeUndefined();
  });
});
