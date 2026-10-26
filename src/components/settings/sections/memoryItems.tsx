import { Brain } from "lucide-react";
import type { Item } from "@/components/settings/sections";
import { RailSwitch } from "@/components/settings/RailSwitch";
import type { useMemory } from "@/hooks/useMemory";
import { memoryDescription } from "@/lib/memory";
import type { Settings } from "@/lib/settings";

/** The memory settings row: its switch. */
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
  const enabled = settings.memory.enabled;
  return [
    {
      section: "Memory",
      title: "Memory",
      description: memory.error ?? memoryDescription(enabled, folderOpen),
      icon: <Brain className="size-4 shrink-0 text-muted-foreground" />,
      alone: true,
      keywords: "memory remember recall context observations cmem claude-mem",
      control: (
        <RailSwitch
          checked={enabled}
          onCheckedChange={async (on) => {
            await onChange({ ...settings, memory: { enabled: on } });
            await memory.changed();
          }}
        />
      ),
    },
  ];
}
