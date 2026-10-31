// The away timer shows once the user has been idle about a minute of its 5.
const SHOWN_UNDER_MS = 4 * 60_000;

/** "3:59" while a waiting call's away time runs out, once it's under 4 minutes; else nothing. */
export function awayCountdown(awayAt: number | undefined, now: number) {
  if (!awayAt) return undefined;
  const left = awayAt - now;
  if (left <= 0 || left > SHOWN_UNDER_MS) return undefined;
  const s = Math.ceil(left / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
