import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenTabContext } from "@/hooks/useOpenTab";
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
