// Any of these on the window means the user is there.
const WINDOW_EVENTS = ["keydown", "pointerdown", "focus", "blur"] as const;

/**
 * Calls `onActive` when the user interacts with the window (a key, a click,
 * focus moving in or out, the page shown or hidden), at most once per
 * `gapMs`, so the sidecar knows they're back (sidecar/awayTimer.ts). Returns
 * a function that stops watching.
 */
export function watchActivity(onActive: () => void, gapMs = 5000) {
  let last = -Infinity;
  const seen = () => {
    const now = Date.now();
    if (now - last < gapMs) return;
    last = now;
    onActive();
  };
  WINDOW_EVENTS.forEach((e) => window.addEventListener(e, seen, true));
  document.addEventListener("visibilitychange", seen);
  return () => {
    WINDOW_EVENTS.forEach((e) => window.removeEventListener(e, seen, true));
    document.removeEventListener("visibilitychange", seen);
  };
}
