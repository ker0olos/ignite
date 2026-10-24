import type { ReactNode } from "react";

/** A tool row's layout: the tile, and beside it the title with the outcome under it. */
export function ToolRowFrame({
  tile,
  head,
  children,
}: {
  tile: ReactNode;
  head: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-tool-row className="flex items-start gap-3.5">
      {tile}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
        {head}
        {children}
      </div>
    </div>
  );
}
