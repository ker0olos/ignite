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

/** Settings rows for the conversation view. */
export function conversationItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    {
      section: "Conversation",
      title: "Show thinking",
      description: "Show the model's reasoning above its replies.",
      keywords: "reasoning thoughts",
      control: (
        <Switch
          checked={settings.conversation.show_thinking}
          onCheckedChange={(show_thinking) =>
            onChange({
              ...settings,
              conversation: { ...settings.conversation, show_thinking },
            })
          }
        />
      ),
    },
    {
      section: "Conversation",
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
      section: "Conversation",
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
      section: "Conversation",
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
