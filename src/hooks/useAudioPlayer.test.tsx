import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "./useAudioPlayer";

let player: ReturnType<typeof useAudioPlayer>;
function Probe() {
  const { ref, ...rest } = useAudioPlayer();
  useEffect(() => {
    player = { ref, ...rest };
  });
  return <audio ref={ref} data-testid="a" />;
}

const mount = () => {
  const { getByTestId } = render(<Probe />);
  const el = getByTestId("a") as HTMLAudioElement;
  Object.defineProperty(el, "duration", { value: 20, configurable: true });
  return el;
};

afterEach(() => vi.restoreAllMocks());

describe("useAudioPlayer", () => {
  it("follows the element's events", () => {
    const el = mount();
    act(() => el.dispatchEvent(new Event("loadedmetadata")));
    expect(player.duration).toBe(20);
    el.currentTime = 7;
    act(() => el.dispatchEvent(new Event("timeupdate")));
    expect(player.time).toBe(7);
    act(() => el.dispatchEvent(new Event("play")));
    expect(player.playing).toBe(true);
    act(() => el.dispatchEvent(new Event("ended")));
    expect(player.playing).toBe(false);
    act(() => el.dispatchEvent(new Event("play")));
    act(() => el.dispatchEvent(new Event("pause")));
    expect(player.playing).toBe(false);
  });

  it("pauses when another clip starts, not for its own play", () => {
    const el = mount();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    act(() => el.dispatchEvent(new Event("play")));
    expect(pause).not.toHaveBeenCalled();
    const other = document.createElement("audio");
    document.body.append(other);
    act(() => other.dispatchEvent(new Event("play")));
    expect(pause).toHaveBeenCalledTimes(1);
    other.remove();
  });

  it("ignores a duration that isn't finite yet", () => {
    const el = mount();
    Object.defineProperty(el, "duration", { value: Infinity });
    act(() => el.dispatchEvent(new Event("loadedmetadata")));
    expect(player.duration).toBe(0);
  });

  it("plays a paused element and pauses a playing one", () => {
    const el = mount();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    act(() => player.toggle());
    expect(play).toHaveBeenCalled();
    Object.defineProperty(el, "paused", { value: false, configurable: true });
    act(() => player.toggle());
    expect(pause).toHaveBeenCalled();
  });

  it("swallows a refused play", async () => {
    mount();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("x"),
    );
    await act(async () => player.toggle());
  });

  it("seeks to a fraction of the duration, clamped", () => {
    const el = mount();
    act(() => el.dispatchEvent(new Event("loadedmetadata")));
    act(() => player.seek(0.25));
    expect(el.currentTime).toBe(5);
    expect(player.time).toBe(5);
    act(() => player.seek(3));
    expect(el.currentTime).toBe(20);
    act(() => player.seek(-1));
    expect(el.currentTime).toBe(0);
  });

  it("does not seek before the duration is known", () => {
    const el = mount();
    el.currentTime = 3;
    act(() => player.seek(0.5));
    expect(el.currentTime).toBe(3);
  });
});
