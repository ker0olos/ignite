import {
  Circle,
  Highlighter,
  MoveUpRight,
  Pen,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOL_KEY, type MarkupTool } from "@/lib/markup";

const TOOLS: { tool: MarkupTool; label: string; icon: LucideIcon }[] = [
  { tool: "pen", label: "Pen", icon: Pen },
  { tool: "highlighter", label: "Highlighter", icon: Highlighter },
  { tool: "arrow", label: "Arrow", icon: MoveUpRight },
  { tool: "rect", label: "Box", icon: Square },
  { tool: "ellipse", label: "Ellipse", icon: Circle },
  { tool: "text", label: "Text", icon: Type },
];

/** The markup tools, one pressed. */
export function MarkupTools({
  tool,
  onTool,
}: {
  tool: MarkupTool;
  onTool: (tool: MarkupTool) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ tool: t, label, icon: Icon }) => (
        <Button
          key={t}
          variant={t === tool ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={t === tool}
          title={`${label} (${TOOL_KEY[t]})`}
          onClick={() => onTool(t)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}
