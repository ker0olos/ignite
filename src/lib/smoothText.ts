const MIN_CHARS_PER_SECOND = 200;
/** How far the reveal may trail the stream: the backlog drains over this long. */
const CATCH_UP_MS = 96;

/** How much of a streaming text to show after one frame of `frameMs`. */
export function revealStep(
  shown: number,
  target: number,
  frameMs: number,
): number {
  if (shown >= target) return target;
  const perMs = Math.max(
    MIN_CHARS_PER_SECOND / 1000,
    (target - shown) / CATCH_UP_MS,
  );
  return Math.min(target, shown + perMs * frameMs);
}
