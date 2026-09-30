import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  addImageTarget,
  currentImageTarget,
  subscribeImageTargets,
  type ImageTarget,
} from "@/lib/imageTarget";

/** Where a marked-up image would go now, or null when no input is showing. */
export function useImageTarget() {
  return useSyncExternalStore(subscribeImageTargets, currentImageTarget);
}

/** Makes this input where marked-up images go while it's mounted; Done says `label`. */
export function useProvideImageTarget(label: string, add: ImageTarget["add"]) {
  const latest = useRef(add);
  useEffect(() => {
    latest.current = add;
  });
  useEffect(
    () =>
      addImageTarget({
        label,
        add: (image, name) => latest.current(image, name),
      }),
    [label],
  );
}
