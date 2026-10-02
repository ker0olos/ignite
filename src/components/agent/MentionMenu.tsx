import { createElement } from "react";
import { Image, Shrink, SquareTerminal, Zap } from "lucide-react";
import { Highlight } from "@/components/command/Highlight";
import { fileIcon } from "@/lib/fileIcons";
import type { MentionOption } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const ICONS = {
  command: Shrink,
  skill: Zap,
  image: Image,
  terminal: SquareTerminal,
};

/** The composer's completions for the `/skill` or `@mention` being typed, above the text. */
export function MentionMenu({
  options,
  selected,
  query,
  onPick,
}: {
  options: MentionOption[];
  selected: number;
  query: string;
  onPick: (option: MentionOption) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div
      role="listbox"
      aria-label="Suggestions"
      className="absolute inset-x-4 bottom-full z-10 mb-1 overflow-hidden rounded-lg border bg-popover p-1 text-[13px] text-popover-foreground shadow-md"
    >
      {options.map((option, i) => {
        const label = option.insert.slice(1);
        const icon =
          option.kind === "file" ? fileIcon(label) : ICONS[option.kind];
        return (
          <div
            key={option.insert}
            role="option"
            aria-selected={i === selected}
            className={cn(
              "flex cursor-default items-center gap-2 rounded-md px-2 py-1",
              i === selected && "bg-accent text-accent-foreground",
            )}
            // Keeps focus (and the caret) in the text.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(option)}
          >
            {createElement(icon, {
              className: "size-3.5 shrink-0 text-muted-foreground",
            })}
            <span className="shrink-0">
              {option.insert[0]}
              <Highlight text={label} query={query} fuzzy />
            </span>
            {option.detail && (
              <span className="min-w-0 truncate text-muted-foreground">
                {option.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
