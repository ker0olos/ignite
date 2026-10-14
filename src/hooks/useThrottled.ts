import { useEffect, useRef, useState } from "react";

/** `value`, changing at most once every `ms`; the latest one always lands, however often it changes. */
export function useThrottled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const last = useRef(0);
  useEffect(() => {
    latest.current = value;
    const show = () => {
      clearTimeout(timer.current);
      timer.current = undefined;
      last.current = Date.now();
      setShown(latest.current);
    };
    // Changes can come faster than a timer gets to run, so one past the interval shows at once.
    const wait = last.current + ms - Date.now();
    if (wait <= 0) show();
    else timer.current ??= setTimeout(show, wait);
  }, [value, ms]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return shown;
}
