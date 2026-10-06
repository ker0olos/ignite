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
  MAX_SIDEBAR_CONVERSATIONS,
  MIN_SIDEBAR_CONVERSATIONS,
  type ConversationOrder,
  type Settings,
} from "@/lib/settings";

const CONVERSATION_ORDERS: { value: ConversationOrder; label: string }[] = [
  { value: "oldest_first", label: "Oldest first (default)" },
  { value: "newest_first", label: "Newest first" },
];

const SIDEBAR_CHAT_COUNTS = Array.from(
  { length: MAX_SIDEBAR_CONVERSATIONS - MIN_SIDEBAR_CONVERSATIONS + 1 },
  (_, i) => MIN_SIDEBAR_CONVERSATIONS + i,
).map((n) => ({ value: String(n), label: String(n) }));

/** Settings rows for the sidebar, shown under Appearance. */
export function sidebarItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  const { sidebar } = settings;
  const change = (patch: Partial<Settings["sidebar"]>) =>
    onChange({ ...settings, sidebar: { ...sidebar, ...patch } });

  return [
    {
      section: "Appearance",
      title: "Sidebar conversation order",
      description: "Order conversations under each folder in the sidebar.",
      keywords:
        "chat conversation sidebar sort ascending descending newest oldest",
      control: (
        <Select
          items={CONVERSATION_ORDERS}
          value={sidebar.conversation_order}
          onValueChange={(value) =>
            value && change({ conversation_order: value as ConversationOrder })
          }
        >
          <SelectTrigger size="sm" className="w-44 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {CONVERSATION_ORDERS.map((order) => (
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
      section: "Appearance",
      title: "Limit sidebar conversations",
      description:
        "Collapse each folder after a maximum number of conversations.",
      keywords: "sidebar chats folders collapse maximum limit",
      control: (
        <Switch
          checked={sidebar.max_conversations_enabled}
          onCheckedChange={(max_conversations_enabled) =>
            change({ max_conversations_enabled })
          }
        />
      ),
    },
    {
      section: "Appearance",
      title: "Sidebar conversations per folder",
      description: "How many conversations to show before the expand button.",
      keywords: "sidebar chats folders collapse maximum limit count",
      control: (
        <Select
          items={SIDEBAR_CHAT_COUNTS}
          value={String(sidebar.max_conversations)}
          disabled={!sidebar.max_conversations_enabled}
          onValueChange={(value) =>
            value && change({ max_conversations: Number(value) })
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
