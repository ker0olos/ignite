import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { appearanceItems } from "./appearanceItems";

type SwitchProps = { checked: boolean; onCheckedChange: (v: boolean) => void };

it("turns the composer's git status off", () => {
  const onChange = vi.fn();
  const row = appearanceItems({
    themes: [],
    settings: DEFAULT_SETTINGS,
    onChange,
    iconThemes: [],
    onThemesChange: vi.fn(),
  }).find((i) => i.title === "Git status")!;
  const { checked, onCheckedChange } = (
    row.control as ReactElement<SwitchProps>
  ).props;
  expect(checked).toBe(true);
  onCheckedChange(false);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    composer: { git_status: false },
  });
});
