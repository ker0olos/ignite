// How strongly the thumb is held at the nearest level while dragging (0 none, 1 locked).
const PULL = 0.55;
// Furthest the thumb stretches past either end, in px.
const STRETCH = 10;

/** Index of the level nearest to `x` px along a track of `width` with `steps` levels. */
export function nearestStep(x: number, width: number, steps: number) {
  const i = Math.round((x / width) * (steps - 1));
  return Math.min(steps - 1, Math.max(0, i));
}

/**
 * Where the thumb shows for a pointer at `raw` px: pulled toward the nearest
 * level, so it snaps over halfway between two, and rubber-banded past the ends.
 */
export function resist(raw: number, width: number, steps: number) {
  const band = (over: number) => STRETCH * (1 - 1 / (1 + over / (STRETCH * 2)));
  if (raw < 0) return -band(-raw);
  if (raw > width) return width + band(raw - width);
  const detent = (nearestStep(raw, width, steps) / (steps - 1)) * width;
  return detent + (raw - detent) * (1 - PULL);
}

/** Green at the lowest effort through amber to red at the highest; `t` is 0–1. */
export function effortColor(t: number) {
  const hue = 145 - 120 * Math.min(1, Math.max(0, t));
  return `oklch(0.72 0.17 ${hue.toFixed(1)})`;
}
