import { MINIMAL_ICONS } from "./iconResolve";
import type { IconThemeInfo } from "./iconThemes";

const MINIMAL: IconThemeInfo = {
  id: MINIMAL_ICONS,
  label: "Minimal",
  source: "Built-in",
  path: "",
};

/** Icon themes by source and label, Minimal first; a saved one that's gone under Missing. */
export function iconThemeGroups(themes: IconThemeInfo[], selected: string) {
  const groups = (["Built-in", "Custom", "VS Code"] as const)
    .map((source) => ({
      source: source as string,
      themes: [
        ...(source === "Built-in" ? [MINIMAL] : []),
        ...themes
          .filter((t) => t.source === source)
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    }))
    .filter((g) => g.themes.length > 0);
  if (selected !== MINIMAL_ICONS && !themes.some((t) => t.id === selected)) {
    groups.unshift({
      source: "Missing",
      themes: [{ id: selected, label: selected, source: "Custom", path: "" }],
    });
  }
  return groups;
}
