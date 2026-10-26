import { Check, X } from "lucide-react";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";
import { outputLabel } from "@/lib/scriptRows";

/** A script's last step: what it returned, or its error, collapsed. */
export function ScriptEnd({
  end,
  text,
}: {
  end: "done" | "failed";
  text: string;
}) {
  const failed = end === "failed";
  return (
    <ToolRowFrame
      tile={
        <ToolTile
          icon={{
            kind: "lucide",
            icon: failed ? X : Check,
            plain: true,
            color: failed ? undefined : "var(--success)",
          }}
          badge={failed ? "error" : undefined}
        />
      }
      head={
        <span className="text-[14px] font-semibold text-foreground">
          {failed ? "Error" : "Done"}
        </span>
      }
    >
      {text && (
        <OutputPreview text={text} error={failed} label={outputLabel(text)} />
      )}
    </ToolRowFrame>
  );
}
