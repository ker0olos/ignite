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

  it("toggles notifications, on by default, before the awake rows", () => {
    const onChange = vi.fn();
    const items = agentItems({
      settings: DEFAULT_SETTINGS,
      onChange,
      isMac: false,
    });
    const notify = items.at(-2)!;
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
      agentItems({ settings, onChange, isMac: false }).at(-1)!;
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

  it("toggles keeping the Mac awake, and shows it only on macOS", () => {
    const onChange = vi.fn();
    const items = agentItems({
      settings: DEFAULT_SETTINGS,
      onChange,
      isMac: true,
    });
    const awake = items.at(-2)!;
    expect(awake.title).toBe("Keep Mac awake");
    const { checked, onCheckedChange } = props<SwitchProps>(awake);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      power: { ...DEFAULT_SETTINGS.power, keep_awake: false },
    });
    const other = agentItems({
      settings: DEFAULT_SETTINGS,
      onChange,
      isMac: false,
    });
    expect(other).toHaveLength(items.length - 2);
  });

  it("toggles keeping the screen awake, disabled while the Mac may sleep", () => {
    const onChange = vi.fn();
    const screen = agentItems({
      settings: DEFAULT_SETTINGS,
      onChange,
      isMac: true,
    }).at(-1)!;
    expect(screen.title).toBe("Keep screen awake");
    const { checked, disabled, onCheckedChange } = props<
      SwitchProps & { disabled: boolean }
    >(screen);
    expect(checked).toBe(false);
    expect(disabled).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      power: { keep_awake: true, keep_screen_awake: true },
    });
    const asleep = agentItems({
      settings: {
        ...DEFAULT_SETTINGS,
        power: { ...DEFAULT_SETTINGS.power, keep_awake: false },
      },
      onChange,
      isMac: true,
    }).at(-1)!;
    expect(props<{ disabled: boolean }>(asleep).disabled).toBe(true);
  });
});
