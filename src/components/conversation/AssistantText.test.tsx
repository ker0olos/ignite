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
vi.mock("@/lib/shellDetect", () => ({
  looksLikeShell: async (code: string) => code.startsWith("echo"),
}));
vi.mock("@tauri-apps/plugin-fs", async (actual) => ({
  ...(await actual<object>()),
  exists: async (path: string) =>
    [
      "/repo/tmp/core-user-tenets-notes.md",
      "/tmp/core-user-tenets-notes.md",
    ].includes(path),
}));

describe("AssistantText file links", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens inline repo file paths in an app tab", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /core-user/ }));
    expect(openTab).toHaveBeenCalledWith("/repo/tmp/core-user-tenets-notes.md");
    expect(opener.openPath).not.toHaveBeenCalled();
  });

  it("opens external absolute file paths through the OS", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /core-user/ }));
    expect(openTab).not.toHaveBeenCalled();
    expect(opener.openPath).toHaveBeenCalledWith(
      "/tmp/core-user-tenets-notes.md",
    );
  });

  it("opens URLs in the browser", () => {
    render(
      <AssistantText
        text="Opened https://github.com/ker0olos/ignite/pull/66."
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pull\/66/ }));
    expect(opener.openUrl).toHaveBeenCalledWith(
      "https://github.com/ker0olos/ignite/pull/66",
    );
  });

  it("opens a link from the keyboard, ignoring other keys", () => {
    render(
      <AssistantText
        text="See https://example.com/a."
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    const link = screen.getByRole("button", { name: /example\.com/ });
    fireEvent.keyDown(link, { key: "a" });
    fireEvent.keyDown(link, { key: "Enter", metaKey: true });
    fireEvent.keyDown(link, { key: "Enter", repeat: true });
    expect(opener.openUrl).not.toHaveBeenCalled();
    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.keyDown(link, { key: " " });
    expect(opener.openUrl).toHaveBeenCalledTimes(2);
    expect(opener.openUrl).toHaveBeenCalledWith("https://example.com/a");
  });

  it("doesn't open a link when the click ends a text selection", () => {
    render(
      <AssistantText
        text="See https://example.com/a."
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    const link = screen.getByRole("button", { name: /example\.com/ });
    vi.spyOn(window, "getSelection").mockReturnValueOnce({
      isCollapsed: false,
    } as Selection);
    fireEvent.click(link);
    expect(opener.openUrl).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(opener.openUrl).toHaveBeenCalledOnce();
  });

  it("leaves branches and files that don't exist as plain code", async () => {
    render(
      <AssistantText
        text="Pushed `feat/self-hosted-server`; see `motr.json`."
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    await screen.findByText("motr.json");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button")).toBe(null);
  });
});

describe("AssistantText code blocks", () => {
  const writeText = vi.fn(async () => {});
  beforeEach(() => Object.assign(navigator, { clipboard: { writeText } }));

  const block = (
    lang: string,
    run: ((c: string) => void) | null,
    code = "echo hi",
  ) =>
    render(
      <RunInTerminalContext.Provider value={run}>
        <AssistantText
          text={"```" + lang + "\n" + code + "\n```"}
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

  it("runs an untagged block that parses as shell commands", async () => {
    const run = vi.fn();
    block("", run);
    fireEvent.click(
      await screen.findByRole("button", { name: "Run in terminal" }),
    );
    expect(run).toHaveBeenCalledWith("echo hi");
  });

  it("offers only Copy for an untagged block that isn't shell", async () => {
    block("", vi.fn(), "Tests 52 passed");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button", { name: "Run in terminal" })).toBe(
      null,
    );
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

describe("AssistantText quotes", () => {
  const writeText = vi.fn(async () => {});
  beforeEach(() => Object.assign(navigator, { clipboard: { writeText } }));

  it("copies a quote as written, with one button for nested ones", () => {
    render(
      <AssistantText
        text={"Reply:\n\n> - Thanks **Kenny**!\n>\n> > [PR](https://x.dev)"}
        folder="/repo"
        editor={DEFAULT_SETTINGS.editor}
        codeThemes={DEFAULT_CODE_THEMES}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(
      "- Thanks **Kenny**!\n\n> [PR](https://x.dev)",
    );
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
