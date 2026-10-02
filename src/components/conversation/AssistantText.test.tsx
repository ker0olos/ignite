import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenTabContext } from "@/hooks/useOpenTab";
import { RunInTerminalContext } from "@/hooks/useRunInTerminal";
import { DEFAULT_CODE_THEMES } from "@/lib/codeThemes";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { AssistantText } from "./AssistantText";

const opener = vi.hoisted(() => ({
  openPath: vi.fn(async () => {}),
  openUrl: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/plugin-opener", () => opener);

describe("AssistantText file links", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens inline repo file paths in an app tab", () => {
    const openTab = vi.fn();
    render(
      <OpenTabContext.Provider value={openTab}>
        <AssistantText
          text="Saved `tmp/core-user-tenets-notes.md`."
          folder="/repo"
          editor={DEFAULT_SETTINGS.editor}
          codeThemes={DEFAULT_CODE_THEMES}
        />
      </OpenTabContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /core-user/ }));
    expect(openTab).toHaveBeenCalledWith("/repo/tmp/core-user-tenets-notes.md");
    expect(opener.openPath).not.toHaveBeenCalled();
  });

  it("opens external absolute file paths through the OS", () => {
    const openTab = vi.fn();
    render(
      <OpenTabContext.Provider value={openTab}>
        <AssistantText
          text="Saved `/tmp/core-user-tenets-notes.md`."
          folder="/repo"
          editor={DEFAULT_SETTINGS.editor}
          codeThemes={DEFAULT_CODE_THEMES}
        />
      </OpenTabContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /core-user/ }));
    expect(openTab).not.toHaveBeenCalled();
    expect(opener.openPath).toHaveBeenCalledWith(
      "/tmp/core-user-tenets-notes.md",
    );
  });
});

describe("AssistantText code blocks", () => {
  const writeText = vi.fn(async () => {});
  beforeEach(() => Object.assign(navigator, { clipboard: { writeText } }));

  const block = (lang: string, run: ((c: string) => void) | null) =>
    render(
      <RunInTerminalContext.Provider value={run}>
        <AssistantText
          text={"```" + lang + "\necho hi\n```"}
          folder="/repo"
          editor={DEFAULT_SETTINGS.editor}
          codeThemes={DEFAULT_CODE_THEMES}
        />
      </RunInTerminalContext.Provider>,
    );

  it("runs a shell block in a terminal", () => {
    const run = vi.fn();
    block("bash", run);
    fireEvent.click(screen.getByRole("button", { name: "Run in terminal" }));
    expect(run).toHaveBeenCalledWith("echo hi");
  });

  it("offers only Copy for other languages, or with no terminal", () => {
    block("ts", vi.fn());
    block("bash", null);
    expect(screen.queryByRole("button", { name: "Run in terminal" })).toBe(
      null,
    );
    expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  });

  it("copies the code, and says so", async () => {
    block("ts", null);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("echo hi");
    await screen.findByRole("button", { name: "Copied" });
  });
});

describe("AssistantText code blocks without a clipboard", () => {
  it("hides Copy, as over plain-HTTP remote access", () => {
    Object.assign(navigator, { clipboard: undefined });
    render(
      <AssistantText
        text={"```ts\nx\n```"}
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBe(null);
  });
});
