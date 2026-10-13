import { openPath } from "@tauri-apps/plugin-opener";
import { createContext, useContext } from "react";
import { filePathTarget, isInsideFolder } from "@/lib/fileLinks";

/** Opens a tab by id; defaults to a no-op outside the workspace. */
export const OpenTabContext = createContext<(id: string) => void>(() => {});

/** Opens a file or diff tab, without prop-drilling through the conversation. */
export function useOpenTab() {
  return useContext(OpenTabContext);
}

/** Opens a file reference: a tab when it's inside `folder`, else the system's app for it. */
export function useOpenFileLink(folder: string) {
  const openTab = useOpenTab();
  return (text: string) => {
    const path = filePathTarget(folder, text);
    if (isInsideFolder(folder, path)) openTab(path);
    else openPath(path).catch(() => {});
  };
}
