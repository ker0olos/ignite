import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { agentItems } from "./agentItems";

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
};
type SelectProps = {
  value: string;
  disabled?: boolean;
  onValueChange: (v: string | null) => void;
};

const props = <T,>(item: { control?: unknown }) =>
  (item.control as ReactElement<T>).props;

describe("agentItems", () => {
  it("toggles full access in Auto, first and off by default", () => {
    const onChange = vi.fn();
    const [full] = agentItems({ settings: DEFAULT_SETTINGS, onChange });
    expect(full.title).toBe("Full access in Auto");
    const { checked, onCheckedChange } = props<SwitchProps>(full);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      approval: { mode: "auto", full_access: true },
    });
  });

  it("toggles subagents on and off", () => {
    const onChange = vi.fn();
    const [, , subagents] = agentItems({
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
    const [, , , max] = agentItems({ settings, onChange });
    expect(max.title).toBe("Subagents at once");
    const { value, disabled, onValueChange } = props<SelectProps>(max);
    expect(value).toBe("3");
    expect(disabled).toBe(true);
    onValueChange("5");
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      subagents: { ...settings.subagents, max: 5 },
    });
  });

  it("toggles notifications, on by default", () => {
    const onChange = vi.fn();
    const notify = agentItems({ settings: DEFAULT_SETTINGS, onChange }).at(-2)!;
    expect(notify.title).toBe("Notifications");
    const { checked, onCheckedChange } = props<SwitchProps>(notify);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      notifications: { enabled: false, sound: true },
    });
  });

  it("toggles the chime, on by default, and only while notifications are on", () => {
    const onChange = vi.fn();
    const sound = (settings: typeof DEFAULT_SETTINGS) =>
      agentItems({ settings, onChange }).at(-1)!;
    expect(sound(DEFAULT_SETTINGS).title).toBe("Notification sound");
    const { checked, disabled, onCheckedChange } = props<SwitchProps>(
      sound(DEFAULT_SETTINGS),
    );
    expect([checked, disabled]).toEqual([true, false]);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      notifications: { enabled: true, sound: false },
    });
    const off = {
      ...DEFAULT_SETTINGS,
      notifications: { enabled: false, sound: true },
    };
    expect(props<SwitchProps>(sound(off)).disabled).toBe(true);
  });
});
