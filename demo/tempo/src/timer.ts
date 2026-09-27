let focus = 25 * 60;
let rest = 5 * 60;

/** Sets how long focus and break sessions last. */
export function setDurations(focusMinutes: number, breakMinutes: number) {
  focus = focusMinutes * 60;
  rest = breakMinutes * 60;
}

/** Formats seconds as mm:ss. */
export function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Counts down in `el`, switching between focus and break. */
export function startTimer(el: HTMLElement) {
  let onBreak = false;
  let left = focus;
  setInterval(() => {
    left -= 1;
    if (left < 0) {
      onBreak = !onBreak;
      left = onBreak ? rest : focus;
    }
    el.textContent = format(left);
  }, 1000);
}
