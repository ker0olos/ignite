import type { ToolCall } from "../../../shared/agentTypes";
import type { QuestionAnswer } from "../../../shared/questions";
import type { ToolRun } from "@/lib/transcript";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";

export type Editor = Settings["editor"];

export type ToolProps = {
  call: ToolCall;
  run: ToolRun | undefined;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  /** Approves or denies a call that waits for the user, or answers its questions. */
  onApprove: (
    toolCallId: string,
    approved: boolean,
    answers?: QuestionAnswer[],
  ) => void;
};

// Lines shown before "… +N lines"; clicking it shows the rest.
export const PREVIEW_LINES = 5;
export const CODE_PREVIEW_LINES = 12;
export const DIFF_PREVIEW_LINES = 40;
