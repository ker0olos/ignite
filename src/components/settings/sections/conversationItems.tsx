import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

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
      title: "Resizable sidebar split",
      description: "Drag the divider between conversations and files.",
      keywords: "height divider conversations files file explorer sidebar",
      control: (
        <Switch
          checked={settings.conversation.resizable_sidebar_split}
          onCheckedChange={(resizable_sidebar_split) =>
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                resizable_sidebar_split,
              },
            })
          }
        />
      ),
    },
  ];
}
