import { McpImportSources } from "@/components/mcp/McpImportSources";
import { McpQuickAdd } from "@/components/mcp/McpQuickAdd";
import type { useMcpServers } from "@/hooks/useMcpServers";

/** The MCP section's extras: servers to import from other apps, presets to add. */
export function McpExtras({ mcp }: { mcp: ReturnType<typeof useMcpServers> }) {
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
