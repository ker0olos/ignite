import { createContext, useContext } from "react";

/** The id of the first call waiting for the user; only it takes the keyboard. */
export const FirstApprovalContext = createContext<string | null>(null);

/** Whether `toolCallId` is the waiting call the keyboard answers. */
export function useIsFirstApproval(toolCallId: string) {
  return useContext(FirstApprovalContext) === toolCallId;
}
