import { describe, expect, it } from "vitest";
import { navEntries, SECTION_NAMES } from "@/components/settings/sections";

describe("navEntries", () => {
  it("collapses the learning sections into one entry at Memory's place", () => {
    const entries = navEntries();
    const labels = entries.map((e) => e.label);
    expect(labels).toContain("Learning");
    for (const s of ["Memory", "Lessons", "Procedures", "Reflector"]) {
      expect(labels).not.toContain(s);
    }
    expect(labels.indexOf("Learning")).toBe(SECTION_NAMES.indexOf("Memory"));
    expect(entries.find((e) => e.label === "Learning")?.sections).toEqual([
      "Memory",
      "Lessons",
      "Procedures",
      "Reflector",
    ]);
    expect(entries.find((e) => e.label === "Chrome")?.sections).toEqual([
      "Chrome",
    ]);
  });
});
