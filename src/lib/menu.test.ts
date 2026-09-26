import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import { menuItems, setAppMenu, type MenuHandlers } from "./menu";

type Item = {
  text?: string;
  item?: unknown;
  items?: Item[];
  accelerator?: string;
  enabled?: boolean;
  action?: () => void;
};

function handlers(folders: string[]): MenuHandlers {
  return {
    folders,
    label: (p) => `label:${p}`,
    openFolder: vi.fn(),
    selectFolder: vi.fn(),
    closeFolder: vi.fn(),
    clearFolders: vi.fn(),
    openSettings: vi.fn(),
  };
}

/** Finds a menu item by its text, searching submenus. */
function find(items: Item[], text: string): Item | undefined {
  for (const item of items) {
    if (item.text === text) return item;
    const inner = item.items && find(item.items, text);
    if (inner) return inner;
  }
}

const build = (h: MenuHandlers) => menuItems(h) as Item[];

describe("setAppMenu", () => {
  it("builds the menu and installs it as the app menu", async () => {
    const calls: string[] = [];
    mockIPC((cmd) => {
      calls.push(cmd);
      return cmd === "plugin:menu|new" ? [1, "menu"] : null;
    });
    await setAppMenu(handlers([]));
    expect(calls[calls.length - 1]).toBe("plugin:menu|set_as_app_menu");
  });
});

describe("menuItems", () => {
  it("keeps the standard Edit items so copy and paste work", () => {
    const edit = find(build(handlers([])), "Edit");
    const kinds = edit?.items?.map((i) => i.item);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "Undo",
        "Redo",
        "Cut",
        "Copy",
        "Paste",
        "SelectAll",
      ]),
    );
  });

  it("binds the expected shortcuts", () => {
    const items = build(handlers([]));
    expect(find(items, "Open Folder…")?.accelerator).toBe("CmdOrCtrl+O");
    expect(find(items, "New Window")?.accelerator).toBe("CmdOrCtrl+Shift+N");
    expect(find(items, "Settings…")?.accelerator).toBe("CmdOrCtrl+,");
  });

  it("wires actions to the handlers", () => {
    const h = handlers([]);
    const items = build(h);
    find(items, "Open Folder…")?.action?.();
    find(items, "Close Folder")?.action?.();
    find(items, "Settings…")?.action?.();
    expect(h.openFolder).toHaveBeenCalledOnce();
    expect(h.closeFolder).toHaveBeenCalledOnce();
    expect(h.openSettings).toHaveBeenCalledOnce();
  });

  describe("Open Recent", () => {
    it("with no folders, only offers a disabled Clear item", () => {
      const recent = find(build(handlers([])), "Open Recent");
      expect(recent?.items).toHaveLength(1);
      expect(recent?.items?.[0]).toMatchObject({
        text: "Clear Recently Opened",
        enabled: false,
      });
    });

    it("lists folders by label, then a separator and an enabled Clear", () => {
      const recent = find(build(handlers(["/a", "/b"])), "Open Recent");
      const items = recent?.items ?? [];
      expect(items.map((i) => i.text ?? i.item)).toEqual([
        "label:/a",
        "label:/b",
        "Separator",
        "Clear Recently Opened",
      ]);
      expect(items[3].enabled).toBe(true);
    });

    it("selects the folder for the clicked item", () => {
      const h = handlers(["/a", "/b"]);
      find(build(h), "label:/b")?.action?.();
      expect(h.selectFolder).toHaveBeenCalledWith("/b");
    });

    it("clears the list from the Clear item", () => {
      const h = handlers(["/a"]);
      find(build(h), "Clear Recently Opened")?.action?.();
      expect(h.clearFolders).toHaveBeenCalledOnce();
    });
  });
});
