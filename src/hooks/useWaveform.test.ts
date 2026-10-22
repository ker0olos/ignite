import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWaveform } from "./useWaveform";

const audio = { type: "audio", data: "AQID", mimeType: "audio/wav" } as const;

afterEach(() => vi.unstubAllGlobals());

function stubContext(decode: () => Promise<unknown>) {
  const decoded = vi.fn(decode);
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData = decoded;
    },
  );
  return decoded;
}

describe("useWaveform", () => {
  it("is null without an OfflineAudioContext", () => {
    const { result } = renderHook(() => useWaveform(audio));
    expect(result.current).toBeNull();
  });

  it("is null when decoding fails", async () => {
    const decode = stubContext(() => Promise.reject(new Error("bad")));
    const { result } = renderHook(() => useWaveform(audio));
    await waitFor(() => expect(decode).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });

  it("returns the decoded clip's peaks", async () => {
    stubContext(() =>
      Promise.resolve({ getChannelData: () => new Float32Array([0.5, 0.25]) }),
    );
    const { result } = renderHook(() => useWaveform(audio));
    await waitFor(() => expect(result.current).toHaveLength(80));
    expect(Math.max(...result.current!)).toBe(1);
  });

  it("drops a decode that finishes after unmount", async () => {
    let finish: (v: unknown) => void = () => {};
    const decode = stubContext(() => new Promise((r) => (finish = r)));
    const { result, unmount } = renderHook(() => useWaveform(audio));
    await waitFor(() => expect(decode).toHaveBeenCalled());
    unmount();
    finish({ getChannelData: () => new Float32Array(1) });
    await Promise.resolve();
    expect(result.current).toBeNull();
  });
});
