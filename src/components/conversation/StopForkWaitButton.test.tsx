import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StopForkWaitButton } from "./StopForkWaitButton";

it("stops waiting once, and offers it again when nothing was held", async () => {
  let finish: (stopped: boolean) => void = () => {};
  const stop = vi.fn(() => new Promise<boolean>((r) => (finish = r)));
  render(<StopForkWaitButton stop={stop} />);
  fireEvent.click(screen.getByRole("button", { name: "Stop waiting" }));
  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "Stopping…",
  });
  expect(button.disabled).toBe(true);
  await act(async () => finish(false));
  expect(screen.getByRole("button", { name: "Stop waiting" })).toBeTruthy();
  expect(stop).toHaveBeenCalledOnce();
});
