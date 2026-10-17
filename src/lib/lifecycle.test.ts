import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import {
  confirmBeforeClose,
  confirmCloseTerminal,
  confirmQuit,
} from "./lifecycle";
import { isRemote } from "./remote";

vi.mock("./remote", () => ({ isRemote: vi.fn(() => false) }));

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

describe("confirmCloseTerminal", () => {
  it("asks in the app's dialog, naming the command when known", async () => {
    let asked = "";
    mockWindows("main");
    mockIPC((cmd, args) => {
      if (cmd !== "plugin:dialog|message") return null;
      asked = (args as { message: string }).message;
      return "Close";
    });
    expect(await confirmCloseTerminal("npm run dev")).toBe(true);
    expect(asked).toBe(
      '"npm run dev" is still running. Stop it and close the terminal?',
    );
  });

  it("asks with the browser's confirm when remote", async () => {
    vi.mocked(isRemote).mockReturnValue(true);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(await confirmCloseTerminal()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      "Close this terminal? Whatever runs in it stops.",
    );
  });
});
