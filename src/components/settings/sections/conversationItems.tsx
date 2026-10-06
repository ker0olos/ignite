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
  const { conversation } = settings;
  const change = (patch: Partial<Settings["conversation"]>) =>
    onChange({ ...settings, conversation: { ...conversation, ...patch } });

  return [
    switchItem({
      title: "Show thinking",
      description:
        "Show the newest line of the model's reasoning while it thinks.",
      keywords: "reasoning thoughts",
      checked: conversation.show_thinking,
      onCheckedChange: (show_thinking) => change({ show_thinking }),
    }),
    switchItem({
      title: "Sticky user messages",
      description:
        "Keep the latest user message pinned at the top while its reply scrolls.",
      keywords: "pin question scroll chat sticky",
      checked: conversation.sticky_user_messages,
      onCheckedChange: (sticky_user_messages) =>
        change({ sticky_user_messages }),
    }),
  ];
}

function switchItem({
  title,
  description,
  keywords,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  keywords: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): Item {
  return {
    section: "Conversation",
    title,
    description,
    keywords,
    control: <Switch checked={checked} onCheckedChange={onCheckedChange} />,
  };
}
