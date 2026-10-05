/** A file a bash command changed: its path from the repository's root and its unified diff, empty when binary or too large. */
export type ShellEdit = { path: string; diff: string };

/** The files a bash call's result says it changed. */
export function readShellEdits(details: unknown): ShellEdit[] {
  const edits = (details as { edits?: unknown } | undefined)?.edits;
  return Array.isArray(edits) ? (edits as ShellEdit[]) : [];
}
