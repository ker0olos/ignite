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

/** Makes this input where marked-up (and dropped) images go while it's mounted, and dropped files with `addFile`; Done says `label`. */
export function useProvideImageTarget(
  label: string,
  add: ImageTarget["add"],
  addFile?: ImageTarget["addFile"],
) {
  const latest = useRef({ add, addFile });
  useEffect(() => {
    latest.current = { add, addFile };
  });
  const takesFiles = !!addFile;
  useEffect(
    () =>
      addImageTarget({
        label,
        add: (image, name) => latest.current.add(image, name),
        ...(takesFiles && {
          addFile: (file) => latest.current.addFile?.(file),
        }),
      }),
    [label, takesFiles],
  );
}
