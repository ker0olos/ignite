import { describe, expect, it } from "vitest";
import { ambient, voice, wav } from "./demoAudio";

const view = (data: string) => {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new DataView(bytes.buffer);
};
const tag = (v: DataView, at: number) =>
  String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(at + i)));

describe("wav", () => {
  it("writes a mono 16-bit PCM header and the samples", () => {
    const v = view(wav(new Float32Array([0, 1, -1, 2]), 8000));
    expect(tag(v, 0)).toBe("RIFF");
    expect(tag(v, 8)).toBe("WAVE");
    expect(v.getUint32(24, true)).toBe(8000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
    expect(tag(v, 36)).toBe("data");
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.byteLength).toBe(52);
    expect([44, 46, 48, 50].map((o) => v.getInt16(o, true))).toEqual([
      0, 32767, -32767, 32767,
    ]);
  });
});

describe("the demo clips", () => {
  it("last 12 and 2.5 seconds, quietly", () => {
    const clip = view(ambient().data);
    expect(clip.getUint32(40, true) / 2 / 22050).toBe(12);
    expect(view(voice().data).getUint32(40, true) / 2 / 22050).toBe(2.5);
    expect(ambient().mimeType).toBe("audio/wav");
    expect(ambient()).toBe(ambient());
    const peak = Math.max(
      ...Array.from({ length: 1000 }, (_, i) =>
        Math.abs(clip.getInt16(44 + i * 500, true)),
      ),
    );
    expect(peak / 32767).toBeLessThanOrEqual(0.4);
  });
});
