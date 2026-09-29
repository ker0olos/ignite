import type { McpCatalog } from "../../../shared/mcpCatalog";
import { Added } from "@/components/mcp/Added";
import { AsyncButton } from "@/components/mcp/AsyncButton";
import { PresetTile } from "@/components/mcp/PresetTile";

/** Preset servers offered for one-click adding. */
export function McpQuickAdd({
  presets,
  onAdd,
}: {
  presets: McpCatalog["presets"];
  onAdd: (id: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="flex items-center gap-3 rounded-md border p-2.5"
        >
          <PresetTile id={preset.id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{preset.name}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {preset.summary}
            </p>
          </div>
          {preset.added ? (
            <Added />
          ) : (
            <AsyncButton onClick={() => onAdd(preset.id)}>Add</AsyncButton>
          )}
        </div>
      ))}
    </div>
  );
}
