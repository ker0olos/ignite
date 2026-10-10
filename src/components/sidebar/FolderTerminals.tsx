import { SquareTerminal } from "lucide-react";
import { ChildRow } from "@/components/sidebar/ChildRow";
import { childTabId } from "@/lib/childTabs";

/** A folder's running terminals under its conversations; each opens its tab, and Stop ends its shell. */
export function FolderTerminals({
  terminals,
  activeTab,
  onOpen,
  onStop,
}: {
  terminals: string[];
  activeTab: string | null;
  onOpen: (terminal: string) => void;
  onStop: (terminal: string) => void;
}) {
  return terminals.map((terminal) => (
    <ChildRow
      key={terminal}
      icon={SquareTerminal}
      name="Terminal"
      detail={terminal}
      running
      selected={
        activeTab === childTabId({ kind: "terminal", session: "", terminal })
      }
      onOpen={() => onOpen(terminal)}
      onStop={() => onStop(terminal)}
      onClear={() => {}}
    />
  ));
}
