import { createContext, useContext } from "react";

/** Opens a tab by id; defaults to a no-op outside the workspace. */
export const OpenTabContext = createContext<(id: string) => void>(() => {});

/** Opens a file or diff tab, without prop-drilling through the conversation. */
export function useOpenTab() {
  return useContext(OpenTabContext);
}
