import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";

/** A finished script's last step: what it returned. */
export function ScriptDone({ text }: { text: string }) {
  return (
    <ToolRowFrame
      tile={<ToolTile icon={{ kind: "done" }} />}
      head={
        <span className="text-[14px] font-semibold text-foreground">Done</span>
      }
    >
      {text && (
        <span className="text-[13.5px] whitespace-pre-wrap text-foreground">
          {text}
        </span>
      )}
    </ToolRowFrame>
  );
}
