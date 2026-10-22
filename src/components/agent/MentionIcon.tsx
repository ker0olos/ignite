import { createElement } from "react";
import {
  CornerDownRight,
  Image,
  Shrink,
  SquareTerminal,
  Zap,
} from "lucide-react";
import { FileIcon } from "@/components/files/FileIcon";
import type { MentionOption } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const ICONS = {
  command: Shrink,
  skill: Zap,
  image: Image,
  terminal: SquareTerminal,
  choice: CornerDownRight,
};

/** A completion's icon: its file's, else its kind's. */
export function MentionIcon({
  option,
  className,
}: {
  option: MentionOption;
  className: string;
}) {
  const icon = cn("shrink-0 text-muted-foreground", className);
  if (option.kind === "file") {
    return (
      <FileIcon
        name={option.detail ?? option.insert.slice(1)}
        className={icon}
      />
    );
  }
  return createElement(ICONS[option.kind], { className: icon });
}
