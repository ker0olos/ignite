import { Menu, type MenuOptions } from "@tauri-apps/api/menu";
import { APP_TITLE } from "./app";
import { openNewWindow } from "./window";

export type MenuHandlers = {
  folders: string[];
  label: (path: string) => string;
  openFolder: () => void;
  selectFolder: (path: string) => void;
  closeFolder: () => void;
  clearFolders: () => void;
  openSettings: () => void;
  closeTab: () => void;
  closeWindow: () => void;
  quit: () => void;
};

/**
 * Installs the macOS menu bar. The menu is app-wide, so the focused window
 * calls this to own the handlers.
 */
export async function setAppMenu(handlers: MenuHandlers) {
  const menu = await Menu.new({ items: menuItems(handlers) });
  await menu.setAsAppMenu();
}

/**
 * The menu bar layout. It replaces the default menu, so the standard Edit
 * items must stay for copy/paste to work in text fields. Quit and window
 * closing are custom items (not the predefined ones) so they can ask first.
 */
export function menuItems({
  folders,
  label,
  openFolder,
  selectFolder,
  closeFolder,
  clearFolders,
  openSettings,
  closeTab,
  closeWindow,
  quit,
}: MenuHandlers): NonNullable<MenuOptions["items"]> {
  return [
    {
      text: APP_TITLE,
      items: [
        { item: { About: null } },
        { item: "Separator" },
        {
          text: "Settings",
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
        { text: `Quit ${APP_TITLE}`, accelerator: "CmdOrCtrl+Q", action: quit },
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
          text: "Open Folder",
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
        { text: "Close Tab", accelerator: "CmdOrCtrl+W", action: closeTab },
        {
          text: "Close Window",
          accelerator: "CmdOrCtrl+Shift+W",
          action: closeWindow,
        },
        { text: "Close Folder", action: () => closeFolder() },
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
    {
      text: "View",
      items: [
        {
          text: "Reload",
          accelerator: "CmdOrCtrl+R",
          action: () => location.reload(),
        },
        { item: "Separator" },
        { item: "Fullscreen" },
      ],
    },
    {
      text: "Window",
      items: [
        { item: "Minimize" },
        { item: "Maximize" },
        { item: "Separator" },
        { item: "BringAllToFront" },
      ],
    },
  ];
}
