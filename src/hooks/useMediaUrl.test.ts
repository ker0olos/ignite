import { renderHook, waitFor } from "@testing-library/react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";

const blobs: Blob[] = [];

// Only the blob methods: the fs plugin checks paths with `instanceof URL`.
beforeEach(() => {
  blobs.length = 0;
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => `blob:${blobs.push(blob)}`,
    revokeObjectURL: vi.fn(),
  });
  vi.resetModules();
});

afterEach(() => clearMocks());

const fresh = async () => (await import("./useMediaUrl")).useMediaUrl;
const video = (path: string) =>
  ({ path, mimeType: "video/mp4" }) as { path: string; mimeType: string };

describe("useMediaUrl", () => {
  it("is undefined without a clip", async () => {
    const useMediaUrl = await fresh();
    const { result } = renderHook(() => useMediaUrl(undefined));
    expect(result.current).toBeUndefined();
  });

  it("makes a typed blob of inline data and keeps it after unmount", async () => {
    const useMediaUrl = await fresh();
    const audio = { data: "AQID", mimeType: "audio/wav" };
    const { result, unmount } = renderHook(() => useMediaUrl(audio));
    await waitFor(() => expect(result.current).toBe("blob:1"));
    expect(blobs[0].type).toBe("audio/wav");
    expect(blobs[0].size).toBe(3);
    unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("reads a file", async () => {
    fakeFs({ "/v/a.mp4": new Uint8Array([1, 2]) });
    const useMediaUrl = await fresh();
    const { result } = renderHook(() => useMediaUrl(video("/v/a.mp4")));
    await waitFor(() => expect(result.current).toBe("blob:1"));
    expect(blobs[0].size).toBe(2);
  });

  it("says missing when the file can't be read, and tries again later", async () => {
    fakeFs({});
    const useMediaUrl = await fresh();
    const first = renderHook(() => useMediaUrl(video("/gone.mp4")));
    await waitFor(() => expect(first.result.current).toBe("missing"));
    first.unmount();
    fakeFs({ "/gone.mp4": new Uint8Array([1]) });
    const second = renderHook(() => useMediaUrl(video("/gone.mp4")));
    await waitFor(() => expect(second.result.current).toBe("blob:1"));
  });

  it("reads the same clip once across mounts", async () => {
    fakeFs({ "/v/a.mp4": new Uint8Array([1]) });
    const useMediaUrl = await fresh();
    const first = renderHook(() => useMediaUrl(video("/v/a.mp4")));
    await waitFor(() => expect(first.result.current).toBe("blob:1"));
    first.unmount();
    const second = renderHook(() => useMediaUrl(video("/v/a.mp4")));
    await waitFor(() => expect(second.result.current).toBe("blob:1"));
    expect(blobs).toHaveLength(1);
  });
});
