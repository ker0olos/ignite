import type { Item } from "@/components/settings/sections";
import { FontInput } from "@/components/settings/FontInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_SETTINGS,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  type Settings,
} from "@/lib/settings";
import { isWindows } from "@/lib/window";

const MOD = isWindows() ? "Ctrl" : "⌘";

const TEXT_SIZES = Array.from(
  { length: MAX_TEXT_SIZE - MIN_TEXT_SIZE + 1 },
  (_, i) => {
    const size = MIN_TEXT_SIZE + i;
    const label =
      size === DEFAULT_SETTINGS.conversation.text_size
        ? `${size} (default)`
        : String(size);
    return { value: String(size), label };
  },
);

/** Settings rows for how text looks: file viewer font and wrap, message size. */
export function editorItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    {
      section: "Editor",
      title: "Font",
      description: "Comma-separated; the first installed one is used.",
      keywords: "font family typeface monospace",
      control: (
        <FontInput
          value={settings.editor.font_family}
          onCommit={(font_family) =>
            onChange({
              ...settings,
              editor: { ...settings.editor, font_family },
            })
          }
        />
      ),
    },
    {
      section: "Editor",
      title: "Word wrap",
      description: "Wrap long lines to the viewer's width.",
      keywords: "line",
      control: (
        <Switch
          checked={settings.editor.word_wrap}
          onCheckedChange={(word_wrap) =>
            onChange({ ...settings, editor: { ...settings.editor, word_wrap } })
          }
        />
      ),
    },
    {
      section: "Editor",
      title: "Message text size",
      description: "Your messages and the agent's replies.",
      hint: (
        <>
          <Kbd className="h-4">{MOD} +</Kbd> <Kbd className="h-4">{MOD} −</Kbd>
        </>
      ),
      keywords: "font zoom bigger smaller conversation chat",
      control: (
        <Select
          items={TEXT_SIZES}
          value={String(settings.conversation.text_size)}
          onValueChange={(value) =>
            value &&
            onChange({
              ...settings,
              conversation: {
                ...settings.conversation,
                text_size: Number(value),
              },
            })
          }
        >
          <SelectTrigger size="sm" className="w-28 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-80">
            {TEXT_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-[13px]">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];
}
