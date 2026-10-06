import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { filesItems } from "./filesItems";

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
};

const find = (
  title: string,
  onChange = vi.fn(),
  settings = DEFAULT_SETTINGS,
) => {
  const items = filesItems({ settings, onChange });
  const item = items.find((i) => i.title === title)!;
  return (item.control as ReactElement<SwitchProps>).props;
};

describe("filesItems", () => {
  it("lists its rows under Appearance", () => {
    const items = filesItems({ settings: DEFAULT_SETTINGS, onChange: vi.fn() });
    expect(items.map((i) => i.title)).toEqual([
      "Show file tree",
      "Resizable sidebar split",
      "Hide Git-ignored files",
    ]);
    expect(items.every((i) => i.section === "Appearance")).toBe(true);
  });

  it("toggles the file tree", () => {
    const onChange = vi.fn();
    const { checked, onCheckedChange } = find("Show file tree", onChange);
    expect(checked).toBe(true);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      files: { ...DEFAULT_SETTINGS.files, show_tree: false },
    });
  });

  it("toggles hiding Git-ignored files", () => {
    const onChange = vi.fn();
    find("Hide Git-ignored files", onChange).onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      files: { ...DEFAULT_SETTINGS.files, hide_gitignored: false },
    });
  });

  it("toggles the resizable sidebar split", () => {
    const onChange = vi.fn();
    const { checked, disabled, onCheckedChange } = find(
      "Resizable sidebar split",
      onChange,
    );
    expect(checked).toBe(true);
    expect(disabled).toBe(false);
    onCheckedChange(false);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      sidebar: { ...DEFAULT_SETTINGS.sidebar, resizable_split: false },
    });
  });

  it("disables the tree's other rows while it's hidden", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      files: { ...DEFAULT_SETTINGS.files, show_tree: false },
    };
    for (const title of ["Resizable sidebar split", "Hide Git-ignored files"])
      expect(find(title, vi.fn(), settings).disabled).toBe(true);
  });
});
