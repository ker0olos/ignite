import { CHROME_TOOLS } from "../../../../shared/chrome";
import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

/** Settings rows for Chrome: the tools as a whole, then each one. */
export function chromeItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  const { chrome } = settings;
  const save = (next: Partial<Settings["chrome"]>) =>
    onChange({ ...settings, chrome: { ...chrome, ...next } });
  return [
    {
      section: "Chrome",
      title: "Chrome tools",
      description:
        "The agent can use your Chrome, or a separate one it starts when yours doesn't allow debugging.",
      keywords: "chrome browser tabs web devtools",
      control: (
        <Switch
          checked={chrome.enabled}
          onCheckedChange={(enabled) => save({ enabled })}
        />
      ),
    },
    ...CHROME_TOOLS.map((tool): Item => ({
      section: "Chrome",
      title: tool.label,
      description: tool.description,
      keywords: `chrome browser ${tool.name}`,
      control: (
        <Switch
          aria-label={tool.label}
          disabled={!chrome.enabled}
          checked={chrome.enabled && !chrome.disabled_tools.includes(tool.name)}
          onCheckedChange={(on) =>
            save({
              disabled_tools: on
                ? chrome.disabled_tools.filter((t) => t !== tool.name)
                : [...chrome.disabled_tools, tool.name],
            })
          }
        />
      ),
    })),
  ];
}
