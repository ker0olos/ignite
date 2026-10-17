import { SquareTerminal } from "lucide-react";
import { ChildRow } from "@/components/sidebar/ChildRow";
import { childTabId, terminalTitle, type TerminalLabel } from "@/lib/childTabs";

/** A folder's running terminals under its conversations; each opens its tab, and Stop ends its shell. */
export function FolderTerminals({
  terminals,
  label,
  activeTab,
  onOpen,
  onStop,
}: {
  terminals: string[];
  label: (terminal: string) => TerminalLabel;
  activeTab: string | null;
  onOpen: (terminal: string) => void;
  onStop: (terminal: string) => void;
}) {
  return terminals.map((terminal) => (
    <ChildRow
      key={terminal}
      icon={SquareTerminal}
      name={terminalTitle(label(terminal))}
      detail={label(terminal).name ?? ""}
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
