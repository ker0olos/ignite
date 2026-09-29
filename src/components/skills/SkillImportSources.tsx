import type { SkillCatalog } from "../../../shared/skills";
import { SkillAppGroup } from "@/components/skills/SkillAppGroup";

/** Other apps' skills found on this Mac, one collapsed group per app. */
export function SkillImportSources({
  sources,
  onImport,
}: {
  sources: SkillCatalog["sources"];
  onImport: (sourceId: string, names: string[]) => Promise<void>;
}) {
  const apps = new Map<string, typeof sources>();
  for (const s of sources) apps.set(s.app, [...(apps.get(s.app) ?? []), s]);
  return (
    <div className="grid gap-2">
      {[...apps].map(([app, own]) => (
        <SkillAppGroup key={app} app={app} sources={own} onImport={onImport} />
      ))}
    </div>
  );
}
