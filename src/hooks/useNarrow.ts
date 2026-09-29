import { useSyncExternalStore } from "react";

// Below the app window's 720px minimum, so only phones get it; Tailwind's max-sm.
const QUERY = "(max-width: 639px)";

const subscribe = (cb: () => void) => {
  const list = matchMedia(QUERY);
  list.addEventListener("change", cb);
  return () => list.removeEventListener("change", cb);
};

/** True on a phone-sized screen (remote access), where panes stack instead of sitting side by side. */
export function useNarrow() {
  return useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches);
}
