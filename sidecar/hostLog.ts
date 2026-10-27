/** The sidecar's log: stderr, which the app shows in its terminal. */
export const log = (message: string) =>
  process.stderr.write(
    `pi-host: ${message} (${Math.round(process.uptime() * 1000)}ms)\n`,
  );

type Request = { type: string; session?: string | null; action?: string };

// unqueue ends the run only when it sends a message now.
const endsRun = (r: Request) =>
  ["abort", "close_session", "rewind"].includes(r.type) ||
  (r.type === "unqueue" && r.action === "now");

/** Logs a request that can end a conversation's run, which one and the UTC time, so an aborted run in its file can be traced to what stopped it. */
export function logIfEndsRuns(request: Request) {
  if (!endsRun(request)) return;
  const which = request.session ?? "the shown or folder's";
  log(`${request.type} ${which} at ${new Date().toISOString()}`);
}
