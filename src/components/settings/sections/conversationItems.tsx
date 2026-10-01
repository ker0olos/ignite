import type { Item } from "@/components/settings/sections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ChatOrder, Settings } from "@/lib/settings";

const CHAT_ORDERS: { value: ChatOrder; label: string }[] = [
  { value: "oldest_first", label: "Oldest first (default)" },
  { value: "newest_first", label: "Newest first" },
];

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
      title: "Sidebar chat order",
      description: "Order conversations under each folder in the sidebar.",
      keywords:
        "chat conversation sidebar sort ascending descending newest oldest",
      control: (
        <Select
          items={CHAT_ORDERS}
          value={settings.conversation.chat_order}
          onValueChange={(value) =>
            value &&
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                chat_order: value as ChatOrder,
              },
            })
          }
        >
          <SelectTrigger size="sm" className="w-44 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {CHAT_ORDERS.map((order) => (
              <SelectItem
                key={order.value}
                value={order.value}
                className="text-[13px]"
              >
                {order.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
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
      title: "Sticky user messages",
      description:
        "Keep the latest user message pinned at the top while its reply scrolls.",
      keywords: "pin question scroll chat sticky",
      control: (
        <Switch
          checked={settings.conversation.sticky_user_messages}
          onCheckedChange={(sticky_user_messages) =>
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                sticky_user_messages,
              },
            })
          }
        />
      ),
    },
  ];
}
