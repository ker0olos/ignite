import { CODEMODE_TOOL } from "../../../shared/codemode";
import { ScriptRow } from "@/components/conversation/ScriptRow";
import type { ToolProps } from "@/components/conversation/shared";
import { ToolView } from "@/components/conversation/ToolView";

/** A tool call's own row: a script with its steps, or any other call. */
export function ToolCallRow(props: ToolProps) {
  return props.call.name === CODEMODE_TOOL ? (
    <ScriptRow {...props} />
  ) : (
    <ToolView {...props} />
  );
}
