import { createContext, type ReactNode } from "react";
import type { ImageContent, ToolCall } from "../../../shared/agentTypes";
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
  /** The conversation's tool runs, so a subagent's nested calls find their approvals. */
  tools?: Record<string, ToolRun>;
  /** Approves or denies a call that waits for the user, or answers its questions; `always` allows what it hit from now on. */
  onApprove: (
    toolCallId: string,
    approved: boolean,
    answers?: QuestionAnswer[],
    always?: boolean,
  ) => void;
};

/** What a diff tab adds to its rows (comments); the conversation's diffs pass none. */
export type RowExtras = {
  /** At the row's start: its comment button. */
  gutter: (row: number) => ReactNode;
  /** Under the row: its comments and comment box. */
  below: (row: number) => ReactNode;
  selected: (row: number) => boolean;
  /** Rows a fold must not hide (ones with comments under them). */
  keep: (row: number) => boolean;
};

/** Ends a running bash call so the agent carries on, false when none ran; null where nothing can (a subagent's calls). */
export const SkipWaitContext = createContext<
  ((toolCallId: string) => Promise<boolean>) | null
>(null);

/** Whether the conversation runs, so a call it never ran (the run was stopped) shows as left. */
export const RunningContext = createContext(false);

/** Which of the composer's questions shows, for its call's "Asking you" line. */
export const AskingStepContext = createContext(0);

/** The id of the conversation rows show in, null for a new one. */
export const ConversationIdContext = createContext<string | null>(null);

/** Each image edit's original by the edit's call id, for its before/after; empty where none is known (a subagent's conversation). */
export const EditOriginalsContext = createContext<
  ReadonlyMap<string, ImageContent>
>(new Map());

/** Sends "Continue" after a failed run; null while one runs, or where nothing can send. */
export const ContinueContext = createContext<(() => void) | null>(null);

// Lines shown before "… +N lines"; clicking it shows the rest.
export const PREVIEW_LINES = 5;
// Also caps one long wrapped line, like an MCP server's JSON.
export const PREVIEW_CHARS = 400;
export const CODE_PREVIEW_LINES = 12;
export const DIFF_PREVIEW_LINES = 40;

/** Editing the shown conversation's user messages; null where none can be edited (a subagent's conversation). */
export type MessageEdit = {
  /** Rewinds to before message `entryId` and sends `text` in its place; false when refused. */
  edit: (
    entryId: string,
    text: string,
    images: ImageContent[],
  ) => Promise<boolean>;
  /** Something runs or waits (a run, routing, compaction, an approval, a queued message, a fork), so Edit is off. */
  disabled: boolean;
};

export const MessageEditContext = createContext<MessageEdit | null>(null);
