import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { macItems } from "./macItems";

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
};

const props = <T,>(item: { control?: unknown }) =>
  (item.control as ReactElement<T>).props;

describe("macItems", () => {
  it("toggles Liquid Glass, on by default", () => {
    const onChange = vi.fn();
    const [glass] = macItems(DEFAULT_SETTINGS, onChange);
    expect(glass.title).toBe("Liquid Glass");
    const { checked, onCheckedChange } = props<SwitchProps>(glass);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      mac: { liquid_glass: false },
    });
  });

  it("toggles keeping the Mac awake", () => {
    const onChange = vi.fn();
    const awake = macItems(DEFAULT_SETTINGS, onChange)[1];
    expect(awake.title).toBe("Keep Mac awake");
    const { checked, onCheckedChange } = props<SwitchProps>(awake);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      power: { ...DEFAULT_SETTINGS.power, keep_awake: false },
    });
  });

  it("toggles keeping the screen awake, disabled while the Mac may sleep", () => {
    const onChange = vi.fn();
    const screen = macItems(DEFAULT_SETTINGS, onChange)[2];
    expect(screen.title).toBe("Keep screen awake");
    const { checked, disabled, onCheckedChange } = props<SwitchProps>(screen);
    expect([checked, disabled]).toEqual([false, false]);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      power: { keep_awake: true, keep_screen_awake: true },
    });
    const asleep = macItems(
      {
        ...DEFAULT_SETTINGS,
        power: { ...DEFAULT_SETTINGS.power, keep_awake: false },
      },
      onChange,
    )[2];
    expect(props<SwitchProps>(asleep).disabled).toBe(true);
  });
});
