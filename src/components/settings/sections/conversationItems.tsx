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

type ConversationSettings = Settings["conversation"];

const CHAT_ORDERS: { value: ChatOrder; label: string }[] = [
  { value: "oldest_first", label: "Oldest first (default)" },
  { value: "newest_first", label: "Newest first" },
];

const SIDEBAR_CHAT_COUNTS = Array.from(
  { length: MAX_SIDEBAR_CHATS - MIN_SIDEBAR_CHATS + 1 },
  (_, i) => MIN_SIDEBAR_CHATS + i,
).map((n) => ({ value: String(n), label: String(n) }));

type ConversationChange = (conversation: ConversationSettings) => void;

/** Settings rows for the conversation view. */
export function conversationItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  const changeConversation: ConversationChange = (conversation) =>
    onChange({ ...settings, conversation });

  return [
    chatOrderItem(settings.conversation, changeConversation),
    switchItem({
      title: "Show thinking",
      description: "Show the model's reasoning above its replies.",
      keywords: "reasoning thoughts",
      checked: settings.conversation.show_thinking,
      onCheckedChange: (show_thinking) =>
        changeConversation({ ...settings.conversation, show_thinking }),
    }),
    switchItem({
      title: "Resizable sidebar split",
      description: "Drag the divider between conversations and files.",
      keywords: "height divider conversations files file explorer sidebar",
      checked: settings.conversation.resizable_sidebar_split,
      onCheckedChange: (resizable_sidebar_split) =>
        changeConversation({
          ...settings.conversation,
          resizable_sidebar_split,
        }),
    }),
    switchItem({
      title: "Sticky user messages",
      description:
        "Keep the latest user message pinned at the top while its reply scrolls.",
      keywords: "pin question scroll chat sticky",
      checked: settings.conversation.sticky_user_messages,
      onCheckedChange: (sticky_user_messages) =>
        changeConversation({
          ...settings.conversation,
          sticky_user_messages,
        }),
    }),
    switchItem({
      title: "Limit sidebar chats",
      description: "Collapse each folder after a maximum number of chats.",
      keywords: "sidebar chats folders collapse maximum limit",
      checked: settings.conversation.max_chats_enabled,
      onCheckedChange: (max_chats_enabled) =>
        changeConversation({ ...settings.conversation, max_chats_enabled }),
    }),
    sidebarChatCountItem(settings.conversation, changeConversation),
  ];
}

function chatOrderItem(
  conversation: ConversationSettings,
  onChange: ConversationChange,
): Item {
  return {
    section: "Conversation",
    title: "Sidebar chat order",
    description: "Order conversations under each folder in the sidebar.",
    keywords:
      "chat conversation sidebar sort ascending descending newest oldest",
    control: (
      <Select
        items={CHAT_ORDERS}
        value={conversation.chat_order}
        onValueChange={(value) =>
          value && onChange({ ...conversation, chat_order: value as ChatOrder })
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
  };
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

function sidebarChatCountItem(
  conversation: ConversationSettings,
  onChange: ConversationChange,
): Item {
  return {
    section: "Conversation",
    title: "Sidebar chats per folder",
    description: "How many chats to show before the expand button.",
    keywords: "sidebar chats folders collapse maximum limit count",
    control: (
      <Select
        items={SIDEBAR_CHAT_COUNTS}
        value={String(conversation.max_chats)}
        disabled={!conversation.max_chats_enabled}
        onValueChange={(value) =>
          value && onChange({ ...conversation, max_chats: Number(value) })
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
  };
}
