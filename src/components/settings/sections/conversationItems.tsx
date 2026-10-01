import type { Item } from "@/components/settings/sections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MAX_SIDEBAR_CHATS,
  MIN_SIDEBAR_CHATS,
  type ChatOrder,
  type Settings,
} from "@/lib/settings";

const CHAT_ORDERS: { value: ChatOrder; label: string }[] = [
  { value: "oldest_first", label: "Oldest first (default)" },
  { value: "newest_first", label: "Newest first" },
];

const SIDEBAR_CHAT_COUNTS = Array.from(
  { length: MAX_SIDEBAR_CHATS - MIN_SIDEBAR_CHATS + 1 },
  (_, i) => MIN_SIDEBAR_CHATS + i,
).map((n) => ({ value: String(n), label: String(n) }));

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
    {
      section: "Conversation",
      title: "Limit sidebar chats",
      description: "Collapse each folder after a maximum number of chats.",
      keywords: "sidebar chats folders collapse maximum limit",
      control: (
        <Switch
          checked={settings.conversation.max_chats_enabled}
          onCheckedChange={(max_chats_enabled) =>
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                max_chats_enabled,
              },
            })
          }
        />
      ),
    },
    {
      section: "Conversation",
      title: "Sidebar chats per folder",
      description: "How many chats to show before the expand button.",
      keywords: "sidebar chats folders collapse maximum limit count",
      control: (
        <Select
          items={SIDEBAR_CHAT_COUNTS}
          value={String(settings.conversation.max_chats)}
          disabled={!settings.conversation.max_chats_enabled}
          onValueChange={(value) =>
            value &&
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                max_chats: Number(value),
              },
            })
          }
        >
          <SelectTrigger size="sm" className="w-16 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {SIDEBAR_CHAT_COUNTS.map((m) => (
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
