import {
  isLearningTab,
  LEARNING,
  SECTIONS,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { LearningFilters } from "@/components/settings/LearningFilters";
import { LearningTabs } from "@/components/settings/LearningTabs";
import { SectionExtras } from "@/components/settings/SectionExtras";
import { SettingsRow } from "@/components/settings/SettingsRow";
import type { useLessons } from "@/hooks/useLessons";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useMemory } from "@/hooks/useMemory";
import type { useProcedures } from "@/hooks/useProcedures";
import type { useReflector } from "@/hooks/useReflector";
import type { useSkills } from "@/hooks/useSkills";
import type { LearningTabInfo } from "@/lib/learning";

/** The dialog's right side: the visible settings, grouped by section. */
export function SettingsSections({
  query,
  groups,
  mcp,
  skills,
  memory,
  lessons,
  procedures,
  reflector,
  folder,
  tabs,
  onSectionChange,
}: {
  query: string;
  groups: (readonly [Section, Item[]])[];
  mcp: ReturnType<typeof useMcpServers>;
  skills: ReturnType<typeof useSkills>;
  memory: ReturnType<typeof useMemory>;
  lessons: ReturnType<typeof useLessons>;
  procedures: ReturnType<typeof useProcedures>;
  reflector: ReturnType<typeof useReflector>;
  folder: string | null;
  tabs: LearningTabInfo[];
  onSectionChange: (section: Section) => void;
}) {
  const q = query.trim();
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-8 pt-6 pb-8 max-sm:px-3 max-sm:pt-4">
      {groups.length === 0 && (
        <p className="mt-16 text-center text-[13px] text-muted-foreground">
          No settings match “{q}”.
        </p>
      )}
      {groups.map(([s, rows]) => (
        <section key={s} className="mb-8">
          {q ? (
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">
              {s}
            </h2>
          ) : (
            <>
              <header className="mb-4">
                <h2 className="text-base font-semibold">
                  {isLearningTab(s) ? "Learning" : s}
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  {isLearningTab(s) ? LEARNING.blurb : SECTIONS[s].blurb}
                </p>
              </header>
              {isLearningTab(s) && (
                <LearningTabs
                  tabs={tabs}
                  section={s}
                  onSectionChange={onSectionChange}
                />
              )}
            </>
          )}
          <div className="space-y-4">
            {rows
              .filter((i) => i.alone)
              .map((i) => (
                <div
                  key={i.id ?? i.title}
                  className="rounded-lg border bg-card"
                >
                  <SettingsRow item={i} />
                </div>
              ))}
            {!q && (
              <LearningFilters
                section={s}
                lessons={lessons}
                procedures={procedures}
                reflector={reflector}
              />
            )}
            {rows.some((i) => !i.alone) && (
              <div className="divide-y rounded-lg border bg-card">
                {rows
                  .filter((i) => !i.alone)
                  .map((i) => (
                    <SettingsRow key={i.id ?? i.title} item={i} />
                  ))}
              </div>
            )}
          </div>
          <SectionExtras
            section={s}
            mcp={mcp}
            skills={skills}
            memory={memory}
            folder={folder}
          />
        </section>
      ))}
    </div>
  );
}
