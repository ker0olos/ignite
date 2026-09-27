import { McpImportSources } from "@/components/mcp/McpImportSources";
import { McpQuickAdd } from "@/components/mcp/McpQuickAdd";
import { MemoryPreview } from "@/components/memory/MemoryPreview";
import type { Section } from "@/components/settings/sections";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useMemory } from "@/hooks/useMemory";

/** What a section shows below its rows: MCP servers to add, recent memories. */
export function SectionExtras({
  section,
  mcp,
  memory,
  folder,
}: {
  section: Section;
  mcp: ReturnType<typeof useMcpServers>;
  memory: ReturnType<typeof useMemory>;
  folder: string | null;
}) {
  if (section === "Memory") {
    return (
      memory.status?.viewerUrl && (
        <MemoryPreview folder={folder} status={memory.status} />
      )
    );
  }
  if (section !== "MCP") return null;
  return (
    <>
      {!!mcp.catalog?.sources.length && (
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
      {!!mcp.catalog?.presets.length && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            Quick add
          </h3>
          <McpQuickAdd presets={mcp.catalog.presets} onAdd={mcp.addPreset} />
        </div>
      )}
    </>
  );
}
