import type { ImageContent } from "./agentTypes.ts";

/** A file a bash command changed: its path from the repository's root, its unified diff (empty when binary or too large) and, for an image, its two versions (one when added or deleted). */
export type ShellEdit = {
  path: string;
  diff: string;
  before?: ImageContent;
  after?: ImageContent;
};

/** The files a bash call's result says it changed. */
export function readShellEdits(details: unknown): ShellEdit[] {
  const edits = (details as { edits?: unknown } | undefined)?.edits;
  return Array.isArray(edits) ? (edits as ShellEdit[]) : [];
}
