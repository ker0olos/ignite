import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { editorItems } from "./editorItems";

type SelectProps = {
  value: string;
  items: { value: string; label: string }[];
  onValueChange: (v: string | null) => void;
};

describe("editorItems", () => {
  it("picks the message text size", () => {
    const onChange = vi.fn();
    const [, , size] = editorItems({ settings: DEFAULT_SETTINGS, onChange });
    expect(size.title).toBe("Message text size");
    const { value, items, onValueChange } = (
      size.control as ReactElement<SelectProps>
    ).props;
    expect(value).toBe("14");
    expect(items.at(0)?.value).toBe("10");
    expect(items.at(-1)?.value).toBe("24");
    expect(items.find((i) => i.value === "14")?.label).toBe("14 (default)");
    onValueChange(null);
    expect(onChange).not.toHaveBeenCalled();
    onValueChange("16");
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: { ...DEFAULT_SETTINGS.conversation, text_size: 16 },
    });
  });
});
