// Only what the user does; focus and visibility also move with no one there.
const WINDOW_EVENTS = ["keydown", "pointerdown", "wheel"] as const;

/** Calls `onActive` when the user uses the window, at most once per `gapMs`; returns a function that stops watching. */
export function watchActivity(onActive: () => void, gapMs = 5000) {
  let last = -Infinity;
  const seen = () => {
    const now = Date.now();
    if (now - last < gapMs) return;
    last = now;
    onActive();
  };
  WINDOW_EVENTS.forEach((e) => window.addEventListener(e, seen, true));
  return () =>
    WINDOW_EVENTS.forEach((e) => window.removeEventListener(e, seen, true));
}
