import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A keyboard-shortcut hint, drawn as an outlined key; the app's one style for them. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-sans text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
