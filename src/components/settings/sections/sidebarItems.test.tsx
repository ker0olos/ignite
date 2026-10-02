import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { sidebarItems } from "./sidebarItems";

type SwitchProps = { checked: boolean; onCheckedChange: (v: boolean) => void };
type SelectProps = {
  value: string;
  disabled?: boolean;
  onValueChange: (v: string | null) => void;
};

const props = <T,>(item: { control?: unknown }) =>
  (item.control as ReactElement<T>).props;

const find = (items: ReturnType<typeof sidebarItems>, title: string) =>
  items.find((i) => i.title === title)!;

describe("sidebarItems", () => {
  it("lists its rows under Appearance in order", () => {
    const items = sidebarItems({
      settings: DEFAULT_SETTINGS,
      onChange: vi.fn(),
    });
    expect(items.map((i) => i.title)).toEqual([
      "Sidebar conversation order",
      "Limit sidebar conversations",
      "Sidebar conversations per folder",
      "Resizable sidebar split",
    ]);
    expect(items.every((i) => i.section === "Appearance")).toBe(true);
  });

  it("toggles the resizable sidebar split", () => {
    const onChange = vi.fn();
    const split = find(
      sidebarItems({ settings: DEFAULT_SETTINGS, onChange }),
      "Resizable sidebar split",
    );
    const { checked, onCheckedChange } = props<SwitchProps>(split);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      sidebar: { ...DEFAULT_SETTINGS.sidebar, resizable_split: true },
    });
  });

  it("toggles the sidebar conversation limit", () => {
    const onChange = vi.fn();
    const limit = find(
      sidebarItems({ settings: DEFAULT_SETTINGS, onChange }),
      "Limit sidebar conversations",
    );
    const { checked, onCheckedChange } = props<SwitchProps>(limit);
    expect(checked).toBe(false);
    onCheckedChange(true);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      sidebar: { ...DEFAULT_SETTINGS.sidebar, max_conversations_enabled: true },
    });
  });

  it("shows the conversation max and disables it until the limit is on", () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      sidebar: {
        ...DEFAULT_SETTINGS.sidebar,
        max_conversations_enabled: false,
        max_conversations: 7,
      },
    };
    const max = find(
      sidebarItems({ settings, onChange }),
      "Sidebar conversations per folder",
    );
    const { value, disabled, onValueChange } = props<SelectProps>(max);
    expect(value).toBe("7");
    expect(disabled).toBe(true);
    onValueChange("9");
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      sidebar: { ...settings.sidebar, max_conversations: 9 },
    });
  });

  it("changes conversation order", () => {
    const onChange = vi.fn();
    const order = find(
      sidebarItems({ settings: DEFAULT_SETTINGS, onChange }),
      "Sidebar conversation order",
    );
    const { value, onValueChange } = props<SelectProps>(order);
    expect(value).toBe("oldest_first");
    onValueChange("newest_first");
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      sidebar: {
        ...DEFAULT_SETTINGS.sidebar,
        conversation_order: "newest_first",
      },
    });
  });
});
