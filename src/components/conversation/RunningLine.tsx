import type { ReactNode } from "react";
import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";

/** Shown under a tool call that runs with nothing (or only `children`) to show yet. */
export function RunningLine({ children }: { children?: ReactNode }) {
  const frame = useSpinnerFrame();
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono">{frame}</span>
      Running…{children}
    </span>
  );
}
