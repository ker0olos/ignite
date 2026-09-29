import {
  SECTIONS,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { SectionExtras } from "@/components/settings/SectionExtras";
import { SettingsRow } from "@/components/settings/SettingsRow";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useMemory } from "@/hooks/useMemory";
import type { useSkills } from "@/hooks/useSkills";

/** The dialog's right side: the visible settings, grouped by section. */
export function SettingsSections({
  query,
  groups,
  mcp,
  skills,
  memory,
  folder,
}: {
  query: string;
  groups: (readonly [Section, Item[]])[];
  mcp: ReturnType<typeof useMcpServers>;
  skills: ReturnType<typeof useSkills>;
  memory: ReturnType<typeof useMemory>;
  folder: string | null;
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
            <header className="mb-4">
              <h2 className="text-base font-semibold">{s}</h2>
              <p className="text-[13px] text-muted-foreground">
                {SECTIONS[s].blurb}
              </p>
            </header>
          )}
          <div className="divide-y rounded-lg border bg-card">
            {rows.map((i) => (
              <SettingsRow key={i.title} item={i} />
            ))}
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
