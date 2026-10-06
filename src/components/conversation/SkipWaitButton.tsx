import { useContext, useState } from "react";
import { FastForward } from "lucide-react";
import type { ToolCall } from "../../../shared/agentTypes";
import { SkipWaitContext } from "@/components/conversation/shared";
import { canSkipWait } from "@/lib/toolRows";
import type { ToolRun } from "@/lib/transcript";

/** Under a running bash call: ends it so the agent carries on with its output so far. */
export function SkipWaitButton({
  call,
  run,
}: {
  call: ToolCall;
  run: ToolRun;
}) {
  const skip = useContext(SkipWaitContext);
  const [skipping, setSkipping] = useState(false);
  if (!skip || !canSkipWait(call, run)) return null;
  return (
    <button
      type="button"
      disabled={skipping}
      onClick={() => {
        setSkipping(true);
        void skip(call.id).then((ended) => ended || setSkipping(false));
      }}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <FastForward className="size-3" />
      {skipping ? "Skipping…" : "Skip wait"}
    </button>
  );
}
