import { useEffect, useRef, useState } from "react";

/** `value`, changing at most once every `ms`; the latest one always lands. */
export function useThrottled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        last.current = Date.now();
        setShown(value);
      },
      Math.max(0, last.current + ms - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [value, ms]);
  return shown;
}
