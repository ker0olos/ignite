import { createContext, useContext } from "react";
import { filePathTarget } from "@/lib/fileLinks";

/** Opens a tab by id; defaults to a no-op outside the workspace. */
export const OpenTabContext = createContext<(id: string) => void>(() => {});

/** Opens a file or diff tab, without prop-drilling through the conversation. */
export function useOpenTab() {
  return useContext(OpenTabContext);
}

/** Opens a file reference, inside `folder` or not, in a tab. */
export function useOpenFileLink(folder: string) {
  const openTab = useOpenTab();
  return (text: string) => openTab(filePathTarget(folder, text));
}
