import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  CommandSearch,
  CommandSearchResult,
} from "../../../shared/conversations";
import { CommandCenter, type CommandActions } from "./CommandCenter";
import { DEFAULT_CODE_THEMES } from "@/lib/codeThemes";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { HostClient } from "@/lib/piHost";

// cmdk measures and scrolls its list, which jsdom can't.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

vi.mock("@/components/command/CommandPreview", () => ({
  CommandPreview: () => <div>Preview pane</div>,
}));

const FOLDERS = ["/p/motr", "/p/sentry-tools"];
const HOME = "/Users/tester";

const CONVERSATIONS = [
  {
    folder: "/p/motr",
    id: "c1",
    title: "Fix the sentry crash",
    modified: Date.now(),
    messageCount: 4,
  },
];
const FILES = [{ folder: "/p/motr", path: "src/sentry.ts" }];

function fakeHost() {
  const request = vi.fn(
    async (req: { type: string } & Partial<CommandSearch>) => {
      if (req.type !== "command_search") return undefined;
      const text = (req.text ?? "").toLowerCase();
      const result: CommandSearchResult = {
        conversations: CONVERSATIONS.filter((c) =>
          c.title.toLowerCase().includes(text),
        ),
        files: FILES.filter((f) => f.path.toLowerCase().includes(text)),
      };
      return result;
    },
  );
  return { request, host: { request } as unknown as HostClient };
}

function renderCenter(initialQuery = "", preview = true) {
  const { request, host } = fakeHost();
  const onOpenChange = vi.fn();
  const actions: CommandActions = {
    onConversation: vi.fn(),
    onFile: vi.fn(),
    onFolder: vi.fn(),
  };
  render(
    <CommandCenter
      open
      onOpenChange={onOpenChange}
      initialQuery={initialQuery}
      host={host}
      folders={FOLDERS}
      home={HOME}
      rows={() => []}
      details={async () => null}
      themes={DEFAULT_CODE_THEMES}
      editor={DEFAULT_SETTINGS.editor}
      actions={actions}
      preview={preview}
    />,
  );
  return { request, onOpenChange, actions };
}

const type = (text: string) =>
  fireEvent.change(
    screen.getByPlaceholderText("Search conversations, files and folders"),
    { target: { value: text } },
  );

describe("CommandCenter", () => {
  it("shows conversation, file and folder results once typing settles", async () => {
    renderCenter();
    type("sentry");
    expect(
      await screen.findByRole("option", { name: /Fix the sentry crash/ }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("option", { name: /sentry-tools/ }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("option", { name: /sentry\.ts/ }),
    ).toBeTruthy();
  });

  it("marks the typed text inside a matching title and file name", async () => {
    renderCenter();
    type("sentry");
    await screen.findByRole("option", { name: /Fix the sentry crash/ });
    const marks = [...document.querySelectorAll("mark")];
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.some((m) => m.textContent === "sentry")).toBe(true);
  });

  it("picking a conversation reports it and closes", async () => {
    const { onOpenChange, actions } = renderCenter();
    type("sentry");
    const item = await screen.findByRole("option", {
      name: /Fix the sentry crash/,
    });
    fireEvent.click(item);
    expect(actions.onConversation).toHaveBeenCalledWith("/p/motr", "c1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("picking a file reports it and closes", async () => {
    const { onOpenChange, actions } = renderCenter();
    type("sentry");
    const item = await screen.findByRole("option", { name: /sentry\.ts/ });
    fireEvent.click(item);
    expect(actions.onFile).toHaveBeenCalledWith("/p/motr", "src/sentry.ts");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("picking a suggestion completes the query instead of closing", async () => {
    const { onOpenChange, actions } = renderCenter();
    type("@sen");
    const suggestion = await screen.findByRole("option", {
      name: /@sentry-tools/,
    });
    fireEvent.click(suggestion);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(actions.onFolder).not.toHaveBeenCalled();
    const input = screen.getByPlaceholderText(
      "Search conversations, files and folders",
    ) as HTMLInputElement;
    expect(input.value).toBe("@sentry-tools ");
  });

  it("says when nothing matches", async () => {
    renderCenter();
    type("zzz-nothing-matches");
    expect(await screen.findByText("Nothing matches.")).toBeTruthy();
  });

  it.each([
    [true, 1],
    [false, 0],
  ])("with preview %s, shows the preview pane %i times", (preview, n) => {
    renderCenter("", preview);
    expect(screen.queryAllByText(/Preview pane/)).toHaveLength(n);
  });
});
