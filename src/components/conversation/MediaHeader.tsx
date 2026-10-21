import type { ReactNode } from "react";
import { Image, PenLine } from "lucide-react";
import type { Generation } from "@/lib/media";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** A generated image card's title row: what it is, the model, what it was edited from, how long it took, then its actions. */
export function MediaHeader({
  generation,
  divided,
  children,
}: {
  generation: Generation;
  divided: boolean;
  children?: ReactNode;
}) {
  const { model, editOf } = generation;
  const Icon = editOf ? PenLine : Image;
  return (
    <div
      className={cn("flex items-center gap-2 px-3 py-2", divided && "border-b")}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="font-semibold">
        {editOf ? "Edited image" : "Generated image"}
      </span>
      <span className="rounded-md border px-1.5 font-mono text-[12px]">
        {model}
      </span>
      {editOf && (
        <span className="truncate text-muted-foreground">
          edit of {basename(editOf)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
