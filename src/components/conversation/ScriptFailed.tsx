import { X } from "lucide-react";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";

/** A failed script's last step: its error, open. */
export function ScriptFailed({ text }: { text: string }) {
  return (
    <ToolRowFrame
      tile={
        <ToolTile
          icon={{ kind: "lucide", icon: X, plain: true }}
          badge="error"
        />
      }
      head={
        <span className="text-[14px] font-semibold text-foreground">
          Failed
        </span>
      }
    >
      <OutputPreview text={text} error defaultOpen />
    </ToolRowFrame>
  );
}
