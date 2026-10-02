import { useEffect, useState } from "react";

const FRAMES = [..."⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"];
const STILL = "⠿";

/** A braille spinner frame, advancing every 80ms; still under reduced motion. */
export function useSpinnerFrame(): string {
  const [i, setI] = useState(0);
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setI((n) => (n + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, [still]);
  return still ? STILL : FRAMES[i];
}
