import { ScriptDone } from "@/components/conversation/ScriptDone";
import { ScriptFailed } from "@/components/conversation/ScriptFailed";

/** A script's last step: what it returned, or why it failed. */
export function ScriptEnd({
  end,
  text,
}: {
  end: "done" | "failed";
  text: string;
}) {
  return end === "done" ? (
    <ScriptDone text={text} />
  ) : (
    <ScriptFailed text={text} />
  );
}
