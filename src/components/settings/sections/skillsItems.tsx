import type { Item } from "@/components/settings/sections";
import { SkillControls } from "@/components/skills/SkillControls";
import type { useSkills } from "@/hooks/useSkills";
import { countOf, firstSentence } from "@/lib/skills";

/** Settings rows for the app's skills and plugins. */
export function skillsItems({
  skills,
}: {
  skills: ReturnType<typeof useSkills>;
}): Item[] {
  if (skills.error) {
    return [
      {
        section: "Skills",
        title: "Something went wrong",
        description: skills.error,
      },
    ];
  }
  if (skills.skills && skills.skills.length === 0) {
    return [
      {
        section: "Skills",
        title: "No skills yet",
        description:
          "Import skills from other apps below, or add folders with a SKILL.md to ~/.ignite/pi/skills.",
      },
    ];
  }
  return (skills.skills ?? []).map((entry) => ({
    section: "Skills",
    title: entry.name,
    description: entry.skills
      ? `Plugin · ${countOf(entry.skills.length, "skill")}`
      : firstSentence(entry.description),
    keywords: `skill plugin ${entry.description} ${entry.skills?.map((s) => s.name).join(" ") ?? ""}`,
    control: (
      <SkillControls
        name={entry.name}
        enabled={entry.enabled}
        skills={entry.skills ?? [entry]}
        onEnabledChange={(enabled) => skills.setEnabled(entry.id, enabled)}
        onAlwaysChange={skills.setAlways}
        onRemove={() => skills.remove(entry.id)}
      />
    ),
  }));
}
