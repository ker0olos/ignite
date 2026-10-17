import { useState } from "react";
import type { useTabs } from "@/hooks/useTabs";
import { terminalOf } from "@/lib/childTabs";
import { ideTabs } from "@/lib/ideTabs";

/** Where the IDE layouts' tabs go (lib/ideTabs), keeping the front tab while the panel's terminal is active. */
export function useIdeTabs({
  files,
  active,
}: Pick<ReturnType<typeof useTabs>, "files" | "active">) {
  const [kept, setKept] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const terminalActive = !!active && terminalOf(active) !== null;
  if (!terminalActive && kept !== active) setKept(active);
  const placed = ideTabs(files, active, { kept, picked });
  if (placed.panel !== picked) setPicked(placed.panel);
  return { ...placed, kept };
}
