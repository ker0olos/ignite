import type { ImageContent } from "../../shared/agentTypes";

/** An input a marked-up image can be added to, and what its Done button says. */
export type ImageTarget = {
  label: string;
  add: (image: ImageContent, name: string) => void;
};

let targets: ImageTarget[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Makes `target` where marked-up images go, over any earlier one, until the returned call. */
export function addImageTarget(target: ImageTarget) {
  targets = [...targets, target];
  changed();
  return () => {
    targets = targets.filter((t) => t !== target);
    changed();
  };
}

/** Calls `listener` whenever the current target changes; returns the unsubscribe. */
export function subscribeImageTargets(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The newest target (an open new-task sheet over the Tasks view), or none. */
export const currentImageTarget = () => targets.at(-1) ?? null;
