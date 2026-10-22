import { describe, expect, it } from "vitest";
import { base64Bytes, clock } from "./audio";

describe("audio", () => {
  it("decodes base64 to bytes", () => {
    expect([...base64Bytes("AQID")]).toEqual([1, 2, 3]);
  });

  it("formats seconds as m:ss", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(7.9)).toBe("0:07");
    expect(clock(125)).toBe("2:05");
    expect(clock(NaN)).toBe("0:00");
    expect(clock(Infinity)).toBe("0:00");
  });
});
