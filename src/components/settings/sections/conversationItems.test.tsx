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
  it("toggles subagents on and off", () => {
    const onChange = vi.fn();
    const [, , subagents] = conversationItems({
      settings: DEFAULT_SETTINGS,
      onChange,
    });
    expect(subagents.title).toBe("Subagents");
    const { checked, onCheckedChange } = props<SwitchProps>(subagents);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      subagents: { ...DEFAULT_SETTINGS.subagents, enabled: false },
    });
  });

  it("shows the max and disables the picker when subagents are off", () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      subagents: { enabled: false, max: 3 },
    };
    const [, , , max] = conversationItems({ settings, onChange });
    expect(max.title).toBe("Subagents per conversation");
    const { value, disabled, onValueChange } = props<SelectProps>(max);
    expect(value).toBe("3");
    expect(disabled).toBe(true);
    onValueChange("5");
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      subagents: { ...settings.subagents, max: 5 },
    });
  });
});
