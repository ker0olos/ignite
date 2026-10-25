import { Check } from "lucide-react";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";
import { outputLabel } from "@/lib/scriptRows";

/** A finished script's last step: what it returned, collapsed. */
export function ScriptDone({ text }: { text: string }) {
  return (
    <ToolRowFrame
      tile={
        <ToolTile
          icon={{
            kind: "lucide",
            icon: Check,
            plain: true,
            color: "var(--success)",
          }}
        />
      }
      head={
        <span className="text-[14px] font-semibold text-foreground">Done</span>
      }
    >
      {text && <OutputPreview text={text} label={outputLabel(text)} />}
    </ToolRowFrame>
  );
}
