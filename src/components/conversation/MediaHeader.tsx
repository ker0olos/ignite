import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A media card's title row: what it is, the model, a note after it, then its actions. */
export function MediaHeader({
  icon: Icon,
  title,
  model,
  note,
  divided,
  children,
}: {
  icon: LucideIcon;
  title: string;
  model?: string;
  note?: string;
  divided: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("flex items-center gap-2 px-3 py-2", divided && "border-b")}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="font-semibold">{title}</span>
      {model && (
        <span className="rounded-md border px-1.5 font-mono text-[12px]">
          {model}
        </span>
      )}
      {note && <span className="truncate text-muted-foreground">{note}</span>}
      <div className="ml-auto flex items-center gap-2 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
