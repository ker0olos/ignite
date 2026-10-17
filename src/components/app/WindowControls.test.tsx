import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { WindowControls } from "@/components/app/WindowControls";

// The window plugin, answering is_maximized with `maximized`; the commands it got.
function fakeWindow(maximized: boolean) {
  const calls: string[] = [];
  mockWindows("main");
  mockIPC(
    (cmd) => {
      calls.push(cmd);
      return cmd === "plugin:window|is_maximized" ? maximized : null;
    },
    { shouldMockEvents: true },
  );
  return calls;
}

it("minimizes, maximizes and closes the window", () => {
  const calls = fakeWindow(false);
  render(<WindowControls />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
  fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(calls).toEqual(
    expect.arrayContaining([
      "plugin:window|minimize",
      "plugin:window|toggle_maximize",
      "plugin:window|close",
    ]),
  );
});

it("offers Restore while the window is maximized", async () => {
  fakeWindow(true);
  render(<WindowControls />);
  expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Maximize" })).toBeNull(),
  );
});
