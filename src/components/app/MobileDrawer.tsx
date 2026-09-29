import type { ReactNode } from "react";

/** The sidebar sliding over a phone's screen; tapping beside it closes it. */
export function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={
        open ? "fixed inset-0 z-40" : "pointer-events-none fixed inset-0 z-40"
      }
    >
      <div
        className={`absolute inset-0 bg-black/10 backdrop-blur-xs transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 w-[85%] max-w-80 border-r bg-sidebar transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {children}
      </div>
    </div>
  );
}
