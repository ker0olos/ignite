import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { conversationItems } from "./conversationItems";

type SwitchProps = { checked: boolean; onCheckedChange: (v: boolean) => void };

const props = <T,>(item: { control?: unknown }) =>
  (item.control as ReactElement<T>).props;

describe("conversationItems", () => {
  it("toggles showing thinking", () => {
    const onChange = vi.fn();
    const thinking = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((item) => item.title === "Show thinking")!;
    const { checked, onCheckedChange } = props<SwitchProps>(thinking);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: { ...DEFAULT_SETTINGS.conversation, show_thinking: true },
    });
  });

  it("toggles sticky user messages", () => {
    const onChange = vi.fn();
    const sticky = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    }).find((item) => item.title === "Sticky user messages")!;
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
});
