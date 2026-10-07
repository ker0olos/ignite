import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

/** Settings rows for macOS: Liquid Glass, and keeping the Mac and its screen awake. */
export function macItems(
  settings: Settings,
  onChange: (settings: Settings) => void,
): Item[] {
  return [
    {
      section: "Mac",
      title: "Liquid Glass",
      description: "The sidebar shows what's behind the window through glass.",
      keywords: "glass translucent transparent vibrancy blur sidebar tahoe",
      control: (
        <Switch
          checked={settings.mac.liquid_glass}
          onCheckedChange={(liquid_glass) =>
            onChange({ ...settings, mac: { ...settings.mac, liquid_glass } })
          }
        />
      ),
    },
    {
      section: "Mac",
      title: "Keep Mac awake",
      description:
        "Your Mac doesn't sleep while the agent works. It can once the agent finishes or waits for you.",
      keywords: "sleep caffeinate awake power battery",
      control: (
        <Switch
          checked={settings.power.keep_awake}
          onCheckedChange={(keep_awake) =>
            onChange({
              ...settings,
              power: { ...settings.power, keep_awake },
            })
          }
        />
      ),
    },
    {
      section: "Mac",
      title: "Keep screen awake",
      description:
        "The display stays on too while the agent works, so you can watch it.",
      keywords: "sleep caffeinate awake power battery display screen",
      control: (
        <Switch
          checked={settings.power.keep_screen_awake}
          disabled={!settings.power.keep_awake}
          onCheckedChange={(keep_screen_awake) =>
            onChange({
              ...settings,
              power: { ...settings.power, keep_screen_awake },
            })
          }
        />
      ),
    },
  ];
}
