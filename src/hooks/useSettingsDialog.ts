import { useState } from "react";
import type { Section } from "@/components/settings/sections";
import { useAbout } from "@/hooks/useAbout";
import { useMemory } from "@/hooks/useMemory";
import type { HostClient } from "@/lib/piHost";

/** The settings dialog: whether it's open, its first section, and what it fetches while open. */
export function useSettingsDialog(
  host: HostClient | null,
  folder: string | null,
) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("Providers");
  const about = useAbout(host, open);
  const show = (next: Section = "Providers") => {
    setSection(next);
    setOpen(true);
  };
  return {
    open,
    setOpen,
    section,
    memory: useMemory(host, folder, open),
    about,
    /** Opens the dialog on `section`. */
    show,
    /** Opens About and checks there, where the result shows. */
    checkForUpdates: () => {
      show("About");
      void about.check();
    },
  };
}
