import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it } from "vitest";
import { confirmBeforeClose, confirmQuit } from "./lifecycle";

/**
 * Fakes the backend with a confirmation dialog that answers `answer` (the
 * label of the button clicked). Returns the commands received.
 */
function fakeDialog(answer: "Quit" | "Close" | "Cancel") {
  const calls: string[] = [];
  mockWindows("main");
  mockIPC(
    (cmd) => {
      calls.push(cmd);
      return cmd === "plugin:dialog|message" ? answer : null;
    },
    { shouldMockEvents: true },
  );
  return calls;
}

describe("confirmQuit", () => {
  it("quits when confirmed", async () => {
    const calls = fakeDialog("Quit");
    await confirmQuit();
    expect(calls).toContain("plugin:process|exit");
  });

  it("does nothing when cancelled", async () => {
    const calls = fakeDialog("Cancel");
    await confirmQuit();
    expect(calls).not.toContain("plugin:process|exit");
  });
});

describe("confirmBeforeClose", () => {
  /** Requests a close and waits for the async handler to finish. */
  async function requestClose() {
    await emit("tauri://close-requested");
    await new Promise((resolve) => setTimeout(resolve));
  }

  it("closes the window when confirmed", async () => {
    const calls = fakeDialog("Close");
    await confirmBeforeClose();
    await requestClose();
    expect(calls).toContain("plugin:dialog|message");
    expect(calls).toContain("plugin:window|destroy");
  });

  it("keeps the window open when cancelled", async () => {
    const calls = fakeDialog("Cancel");
    await confirmBeforeClose();
    await requestClose();
    expect(calls).toContain("plugin:dialog|message");
    expect(calls).not.toContain("plugin:window|destroy");
  });
});
