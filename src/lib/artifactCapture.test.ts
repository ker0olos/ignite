import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFrame } from "./artifactCapture";

function frameAnswering(reply: (id: string) => Record<string, unknown>) {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const win = frame.contentWindow!;
  vi.spyOn(win, "postMessage").mockImplementation((message: unknown) => {
    const { id } = message as { id: string };
    // Another frame's answer first, which must be ignored.
    dispatchEvent(new MessageEvent("message", { data: { id, url: "x" } }));
    dispatchEvent(
      new MessageEvent("message", { data: { id, ...reply(id) }, source: win }),
    );
  });
  return frame;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("captureFrame", () => {
  it("resolves with the PNG the frame posts back", async () => {
    const frame = frameAnswering(() => ({ url: "data:image/png;base64,QUJD" }));
    await expect(captureFrame(frame)).resolves.toEqual({
      type: "image",
      data: "QUJD",
      mimeType: "image/png",
    });
  });

  it("rejects with the frame's error", async () => {
    const frame = frameAnswering(() => ({ error: "tainted" }));
    await expect(captureFrame(frame)).rejects.toThrow("tainted");
  });

  it("ignores answers to another capture", async () => {
    const frame = frameAnswering(() => ({ id: "other", url: "x" }));
    await expect(captureFrame(frame, 20)).rejects.toThrow("in time");
  });

  it("fails at once when the frame has no page", async () => {
    const frame = document.createElement("iframe");
    await expect(captureFrame(frame)).rejects.toThrow("isn't loaded");
  });

  it("gives up when the page never answers", async () => {
    vi.useFakeTimers();
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const shot = captureFrame(frame);
    const failed = expect(shot).rejects.toThrow("in time");
    await vi.advanceTimersByTimeAsync(10000);
    await failed;
  });
});
