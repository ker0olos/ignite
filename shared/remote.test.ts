import { describe, expect, it } from "vitest";
import { fromWire, toWire } from "./remote.ts";

describe("toWire / fromWire", () => {
  it("carries bytes through JSON, and leaves other values alone", () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256);
    const back = fromWire(JSON.parse(JSON.stringify(toWire(bytes))));
    expect(back).toEqual(bytes);
    expect(fromWire(toWire(bytes.buffer))).toEqual(bytes);
    expect(toWire({ path: "/x" })).toEqual({ path: "/x" });
    expect(fromWire(null)).toBe(null);
  });
});
