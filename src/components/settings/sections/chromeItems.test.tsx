import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { chromeItems } from "./chromeItems";

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
};

const props = (item: { control?: unknown }) =>
  (item.control as ReactElement<SwitchProps>).props;

describe("chromeItems", () => {
  it("turns Chrome off as a whole", () => {
    const onChange = vi.fn();
    const [all] = chromeItems({ settings: DEFAULT_SETTINGS, onChange });
    props(all).onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      chrome: { enabled: false, disabled_tools: [] },
    });
  });

  it("turns one tool off and on again", () => {
    const onChange = vi.fn();
    const [, tabs] = chromeItems({ settings: DEFAULT_SETTINGS, onChange });
    expect(props(tabs).checked).toBe(true);
    props(tabs).onCheckedChange(false);
    const off = {
      ...DEFAULT_SETTINGS,
      chrome: { enabled: true, disabled_tools: ["chrome_tabs"] },
    };
    expect(onChange).toHaveBeenLastCalledWith(off);
    const [, again] = chromeItems({ settings: off, onChange });
    expect(props(again).checked).toBe(false);
    props(again).onCheckedChange(true);
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_SETTINGS);
  });

  it("shows every tool off and locked while Chrome is off", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      chrome: { enabled: false, disabled_tools: [] },
    };
    const [, ...tools] = chromeItems({ settings, onChange: vi.fn() });
    expect(tools.map((t) => [props(t).checked, props(t).disabled])).toEqual(
      tools.map(() => [false, true]),
    );
  });
});
