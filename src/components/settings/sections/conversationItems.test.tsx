import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { conversationItems } from "./conversationItems";

type SwitchProps = { checked: boolean; onCheckedChange: (v: boolean) => void };
type SelectProps = {
  value: string;
  disabled?: boolean;
  onValueChange: (v: string | null) => void;
};

const props = <T,>(item: { control?: unknown }) =>
  (item.control as ReactElement<T>).props;

describe("conversationItems", () => {
  it("toggles the sidebar chat limit", () => {
    const onChange = vi.fn();
    const [, limit] = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    });
    expect(limit.title).toBe("Limit sidebar chats");
    const { checked, onCheckedChange } = props<SwitchProps>(limit);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: {
        ...DEFAULT_SETTINGS.conversation,
        max_chats_enabled: true,
      },
    });
  });

  it("shows the chat max and disables it until the limit is on", () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      conversation: {
        ...DEFAULT_SETTINGS.conversation,
        max_chats_enabled: false,
        max_chats: 7,
      },
    };
    const [, , max] = conversationItems({ settings, onChange });
    expect(max.title).toBe("Sidebar chats per folder");
    const { value, disabled, onValueChange } = props<SelectProps>(max);
    expect(value).toBe("7");
    expect(disabled).toBe(true);
    onValueChange("9");
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      conversation: { ...settings.conversation, max_chats: 9 },
    });
  });
});
