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

const item = (title: string) => {
  const found = conversationItems({
    settings: DEFAULT_SETTINGS,
    onChange: vi.fn(),
  }).find((i) => i.title === title);
  if (!found) throw new Error(`Missing ${title}`);
  return found;
};

describe("conversationItems", () => {
  it("toggles showing thinking", () => {
    const onChange = vi.fn();
    const thinking = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((i) => i.title === "Show thinking")!;
    const { checked, onCheckedChange } = props<SwitchProps>(thinking);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: { ...DEFAULT_SETTINGS.conversation, show_thinking: true },
    });
  });

  it("toggles the resizable sidebar split", () => {
    const onChange = vi.fn();
    const split = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((i) => i.title === "Resizable sidebar split")!;
    const { checked, onCheckedChange } = props<SwitchProps>(split);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: {
        ...DEFAULT_SETTINGS.conversation,
        resizable_sidebar_split: true,
      },
    });
  });

  it("toggles sticky user messages", () => {
    const onChange = vi.fn();
    const sticky = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((i) => i.title === "Sticky user messages")!;
    const { checked, onCheckedChange } = props<SwitchProps>(sticky);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: {
        ...DEFAULT_SETTINGS.conversation,
        sticky_user_messages: true,
      },
    });
  });

  it("toggles the sidebar chat limit", () => {
    const onChange = vi.fn();
    const limit = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((i) => i.title === "Limit sidebar chats")!;
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
    const max = conversationItems({ settings, onChange }).find(
      (i) => i.title === "Sidebar chats per folder",
    )!;
    const { value, disabled, onValueChange } = props<SelectProps>(max);
    expect(value).toBe("7");
    expect(disabled).toBe(true);
    onValueChange("9");
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      conversation: { ...settings.conversation, max_chats: 9 },
    });
  });

  it("shows chat order choices", () => {
    const order = item("Sidebar chat order");
    const { value } = props<SelectProps>(order);
    expect(value).toBe("oldest_first");
  });
});
