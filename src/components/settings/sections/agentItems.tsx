import type { Item } from "@/components/settings/sections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

const MAX_SUBAGENTS = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));

/** Settings rows for how the agent works: questions and subagents. */
export function agentItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    {
      section: "Agent",
      title: "Ask before deciding",
      description:
        "The agent asks you about open choices, with options to pick from. Off, it decides on its own.",
      keywords: "questions autonomous choices options",
      control: (
        <Switch
          checked={settings.conversation.ask_questions}
          onCheckedChange={(ask_questions) =>
            onChange({
              ...settings,
              conversation: { ...settings.conversation, ask_questions },
            })
          }
        />
      ),
    },
    {
      section: "Agent",
      title: "Subagents",
      description:
        "The agent can hand tasks to a smaller model from the same provider, at a lower effort, and talk with it.",
      keywords: "subagents delegate agents helpers",
      control: (
        <Switch
          checked={settings.subagents.enabled}
          onCheckedChange={(enabled) =>
            onChange({
              ...settings,
              subagents: { ...settings.subagents, enabled },
            })
          }
        />
      ),
    },
    {
      section: "Agent",
      title: "Subagents per conversation",
      description: "How many subagents one conversation may start.",
      keywords: "subagents delegate agents helpers max",
      control: (
        <Select
          items={MAX_SUBAGENTS}
          value={String(settings.subagents.max)}
          disabled={!settings.subagents.enabled}
          onValueChange={(value) =>
            value &&
            onChange({
              ...settings,
              subagents: { ...settings.subagents, max: Number(value) },
            })
          }
        >
          <SelectTrigger size="sm" className="w-16 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {MAX_SUBAGENTS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-[13px]">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];
}
