import type { ReactNode } from "react";
import type { Item, Section } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";

/** A learning section's first row, like Memory's: what it does, and its switch. */
export function learningSwitchItem({
  section,
  icon,
  description,
  keywords,
  checked,
  onCheckedChange,
}: {
  section: Section;
  icon: ReactNode;
  description: string;
  keywords: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void | Promise<void>;
}): Item {
  return {
    section,
    title: section,
    description,
    icon,
    keywords,
    control: (
      <Switch
        checked={checked}
        onCheckedChange={(on) => void onCheckedChange(on)}
      />
    ),
  };
}
