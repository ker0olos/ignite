import { useState } from "react";
import type { useTabs } from "@/hooks/useTabs";
import { terminalOf } from "@/lib/childTabs";
import { ideTabs } from "@/lib/ideTabs";

/** Where the IDE layouts' tabs go (lib/ideTabs), keeping the front tab while VS Code's panel terminal is active. */
export function useIdeTabs(
  { files, active }: Pick<ReturnType<typeof useTabs>, "files" | "active">,
  panel: boolean,
) {
  const [kept, setKept] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const terminalActive = panel && !!active && terminalOf(active) !== null;
  if (!terminalActive && kept !== active) setKept(active);
  const placed = ideTabs(files, active, { kept, picked }, panel);
  if (placed.panel !== picked) setPicked(placed.panel);
  return { ...placed, kept };
}
