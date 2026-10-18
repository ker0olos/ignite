import type { ReactNode } from "react";
import { X } from "lucide-react";

/** One item of the composer's attachment strip, with the X that removes it on hover. */
export function RemovableAttachment({
  label,
  onRemove,
  children,
}: {
  /** The X's aria label: "Remove image". */
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group/attachment relative">
      {children}
      <button
        type="button"
        aria-label={label}
        className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover/attachment:flex"
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
