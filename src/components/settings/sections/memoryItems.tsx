import { openUrl } from "@tauri-apps/plugin-opener";
import { Brain } from "lucide-react";
import type { Item } from "@/components/settings/sections";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { useMemory } from "@/hooks/useMemory";
import { memoryDescription } from "@/lib/memory";
import type { Settings } from "@/lib/settings";

const CMEM_URL = "https://cmem.ai";

/** The cmem settings row: its switch, or a link to get it. */
export function memoryItems({
  memory,
  folderOpen,
  settings,
  onChange,
}: {
  memory: ReturnType<typeof useMemory>;
  folderOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void | Promise<void>;
}): Item[] {
  const { status, error } = memory;
  const enabled = settings.memory.cmem;
  return [
    {
      section: "Memory",
      title: "cmem",
      description:
        error ?? memoryDescription(status?.state, enabled, folderOpen),
      icon: <Brain className="size-4 shrink-0 text-muted-foreground" />,
      keywords: "memory remember recall context observations cmem",
      control:
        status?.state === "not-installed" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUrl(CMEM_URL).catch(() => {})}
          >
            Get cmem
          </Button>
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={async (cmem) => {
              await onChange({ ...settings, memory: { cmem } });
              await memory.changed();
            }}
          />
        ),
    },
  ];
}
