import { createContext, useContext } from "react";

/** Opens a terminal tab and runs a command in it; null where there's no terminal. */
export const RunInTerminalContext = createContext<
  ((command: string) => void) | null
>(null);

/** The workspace's run-in-terminal, without prop-drilling through the conversation. */
export function useRunInTerminal() {
  return useContext(RunInTerminalContext);
}
