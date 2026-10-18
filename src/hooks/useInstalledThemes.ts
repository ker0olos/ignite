import { useEffect, useState } from "react";
import type { CodeTheme } from "@/lib/codeThemes";
import { listThemes } from "@/lib/codeThemeDiscovery";
import { listIconThemes, type IconThemeInfo } from "@/lib/iconThemes";

/** The code and icon themes to pick from, scanned again on every open so newly installed ones show up. */
export function useInstalledThemes(open: boolean) {
  const [themes, setThemes] = useState<CodeTheme[]>([]);
  const [iconThemes, setIconThemes] = useState<IconThemeInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    listThemes(true).then(setThemes);
    listIconThemes(true).then(setIconThemes);
  }, [open]);

  return { themes, setThemes, iconThemes };
}
