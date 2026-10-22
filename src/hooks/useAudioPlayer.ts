import { useEffect, useRef, useState } from "react";

/** An audio element's state: playing, time and length, with toggle and seek (a fraction 0..1). */
export function useAudioPlayer() {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      setTime(el.currentTime);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const events: [string, () => void][] = [
      ["timeupdate", sync],
      ["loadedmetadata", sync],
      ["ended", pause],
      ["play", play],
      ["pause", pause],
    ];
    // Media events don't bubble, so another clip starting is heard in the capture phase.
    const others = (event: Event) => {
      if (event.target !== el) el.pause();
    };
    for (const [name, fn] of events) el.addEventListener(name, fn);
    document.addEventListener("play", others, true);
    return () => {
      for (const [name, fn] of events) el.removeEventListener(name, fn);
      document.removeEventListener("play", others, true);
    };
  }, []);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };
  const seek = (fraction: number) => {
    const el = ref.current;
    if (!el || !duration) return;
    el.currentTime = Math.min(1, Math.max(0, fraction)) * duration;
    setTime(el.currentTime);
  };
  return { ref, playing, time, duration, toggle, seek };
}
