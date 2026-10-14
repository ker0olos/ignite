import { describe, expect, it } from "vitest";
import { iconThemeGroups } from "./iconThemeGroups";
import type { IconThemeInfo } from "./iconThemes";

const t = (id: string, source: IconThemeInfo["source"]): IconThemeInfo => ({
  id,
  label: id,
  source,
  path: `/${id}.json`,
});

describe("iconThemeGroups", () => {
  it("groups by source, sorted, leaving out empty ones", () => {
    expect(
      iconThemeGroups(
        [t("seti", "VS Code"), t("material", "VS Code")],
        "minimal",
      ),
    ).toEqual([
      {
        source: "Built-in",
        themes: [
          { id: "minimal", label: "Minimal", source: "Built-in", path: "" },
        ],
      },
      {
        source: "VS Code",
        themes: [t("material", "VS Code"), t("seti", "VS Code")],
      },
    ]);
  });

  it("puts bundled themes first, after Minimal", () => {
    const groups = iconThemeGroups(
      [t("seti", "VS Code"), t("jetbrains", "Built-in")],
      "jetbrains",
    );
    expect(groups.map((g) => g.source)).toEqual(["Built-in", "VS Code"]);
    expect(groups[0].themes.map((x) => x.id)).toEqual(["minimal", "jetbrains"]);
  });

  it("lists a saved theme that's gone under Missing", () => {
    const [missing] = iconThemeGroups([t("seti", "Custom")], "gone");
    expect(missing.source).toBe("Missing");
    expect(missing.themes[0].id).toBe("gone");
  });
});
