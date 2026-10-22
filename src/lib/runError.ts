// claude-bridge leads Claude Code's own limit wording with this, for pi's retry and fallback matching.
const BRIDGE_LIMIT = /^Claude quota exceeded — rate limit.*?: /;

/** Longer errors are diagnostics (a stack, a provider's essay), kept under Details. */
export const SHORT_ERROR = 160;

/** A run's error as the user reads it: Claude Code's limit wording without the bridge's prefix. */
export const runError = (errorMessage = "") =>
  errorMessage.replace(BRIDGE_LIMIT, "");

/** The error a failed reply's end row shows as its line, if it shows one. */
export function shownError(message: {
  stopReason?: string;
  errorMessage?: string;
}) {
  const error = runError(message.errorMessage);
  return message.stopReason === "error" && error && error.length <= SHORT_ERROR
    ? error
    : undefined;
}
