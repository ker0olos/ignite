import { SkillImportSources } from "@/components/skills/SkillImportSources";
import type { useSkills } from "@/hooks/useSkills";

/** The Skills section's extras: skills to import from other apps. */
export function SkillsExtras({
  skills,
}: {
  skills: ReturnType<typeof useSkills>;
}) {
  if (!skills.catalog?.sources.length) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">
        Import from other apps
      </h3>
      <SkillImportSources
        sources={skills.catalog.sources}
        onImport={skills.importSkills}
      />
    </div>
  );
}
