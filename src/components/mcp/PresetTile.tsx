import { Plug } from "lucide-react";
import { Glyph } from "@/components/mcp/Glyph";
import { PRESETS } from "@/components/mcp/marks";

/** A preset's mark on a tile tinted with its brand colour. */
export function PresetTile({ id }: { id: string }) {
  const mark = PRESETS[id] ?? { icon: Plug };
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
      style={
        mark.color
          ? {
              backgroundColor: `color-mix(in oklab, ${mark.color} 16%, transparent)`,
            }
          : undefined
      }
    >
      <Glyph mark={mark} />
    </div>
  );
}
