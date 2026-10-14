import { useMemo } from "react";
import type { ToolCall } from "../../shared/agentTypes";
import { useThrottled } from "@/hooks/useThrottled";
import { draftArgs } from "@/lib/artifact";

// Each change redraws an artifact's frame, so a page being written updates a few times a second.
const REDRAW_MS = 300;

/** A tool call with its arguments so far while it's written, else as it is. */
export function useStreamedCall(call: ToolCall): ToolCall {
  const json = useThrottled(call.partialJson, REDRAW_MS);
  const args = useMemo(
    () => (json === undefined ? undefined : draftArgs(json)),
    [json],
  );
  if (call.partialJson === undefined) return call;
  return { ...call, arguments: args ?? {} };
}
