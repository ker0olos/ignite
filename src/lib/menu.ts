import { Menu } from "@tauri-apps/api/menu";
import { openNewWindow } from "./window";

type MenuHandlers = {
  folders: string[];
  label: (path: string) => string;
  openFolder: () => void;
  selectFolder: (path: string) => void;
  closeFolder: () => void;
  clearFolders: () => void;
  openSettings: () => void;
};

/**
 * Installs the macOS menu bar. The menu is app-wide, so the focused window
 * calls this to own the handlers. It replaces the default menu, so the
 * standard Edit items must stay for copy/paste to work.
 */
export async function setAppMenu({
  folders,
  label,
  openFolder,
  selectFolder,
  closeFolder,
  clearFolders,
  openSettings,
}: MenuHandlers) {
  const menu = await Menu.new({
    items: [
      {
        text: "untitledharness",
        items: [
          { item: { About: null } },
          { item: "Separator" },
          {
            text: "Settings…",
            accelerator: "CmdOrCtrl+,",
            action: openSettings,
          },
          { item: "Separator" },
          { item: "Services" },
          { item: "Separator" },
          { item: "Hide" },
          { item: "HideOthers" },
          { item: "ShowAll" },
          { item: "Separator" },
          { item: "Quit" },
        ],
      },
      {
        text: "File",
        items: [
          {
            text: "New Window",
            accelerator: "CmdOrCtrl+Shift+N",
            action: openNewWindow,
          },
          { item: "Separator" },
          {
            text: "Open Folder…",
            accelerator: "CmdOrCtrl+O",
            action: openFolder,
          },
          {
            text: "Open Recent",
            items: [
              ...folders.map((path) => ({
                text: label(path),
                action: () => selectFolder(path),
              })),
              ...(folders.length ? [{ item: "Separator" as const }] : []),
              {
                text: "Clear Recently Opened",
                enabled: folders.length > 0,
                action: clearFolders,
              },
            ],
          },
          { item: "Separator" },
          { text: "Close Folder", action: closeFolder },
          { item: "CloseWindow" },
        ],
      },
      {
        text: "Edit",
        items: [
          { item: "Undo" },
          { item: "Redo" },
          { item: "Separator" },
          { item: "Cut" },
          { item: "Copy" },
          { item: "Paste" },
          { item: "SelectAll" },
        ],
      },
      { text: "View", items: [{ item: "Fullscreen" }] },
      {
        text: "Window",
        items: [
          { item: "Minimize" },
          { item: "Maximize" },
          { item: "Separator" },
          { item: "BringAllToFront" },
        ],
      },
    ],
  });
  await menu.setAsAppMenu();
}
