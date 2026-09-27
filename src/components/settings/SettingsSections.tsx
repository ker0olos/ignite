import { McpImportSources } from "@/components/mcp/McpImportSources";
import { McpQuickAdd } from "@/components/mcp/McpQuickAdd";
import {
  SECTIONS,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { SettingsRow } from "@/components/settings/SettingsRow";
import type { useMcpServers } from "@/hooks/useMcpServers";

/** The dialog's right side: the visible settings, grouped by section. */
export function SettingsSections({
  query,
  groups,
  mcp,
}: {
  query: string;
  groups: (readonly [Section, Item[]])[];
  mcp: ReturnType<typeof useMcpServers>;
}) {
  const q = query.trim();
  return (
    <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-8 pt-6 pb-8">
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
          {s === "MCP" && !!mcp.catalog?.sources.length && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Import from other apps
              </h3>
              <McpImportSources
                sources={mcp.catalog.sources}
                onImport={mcp.importServers}
              />
            </div>
          )}
          {s === "MCP" && !!mcp.catalog?.presets.length && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Quick add
              </h3>
              <McpQuickAdd
                presets={mcp.catalog.presets}
                onAdd={mcp.addPreset}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
