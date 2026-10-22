import { CommandArgs } from "@/components/agent/CommandArgs";
import { MentionIcon } from "@/components/agent/MentionIcon";
import { Highlight } from "@/components/command/Highlight";
import type { MentionOption } from "@/lib/mentions";
import { cn } from "@/lib/utils";

// A `/command` reads like Discord's: name and arguments over its description.
const LOOKS = {
  slash: {
    row: "gap-2.5 py-1.5",
    icon: "size-4",
    body: "flex-col",
    head: "min-w-0",
    name: "font-medium",
    detail: "text-xs",
  },
  line: {
    row: "gap-2 py-1",
    icon: "size-3.5",
    body: "gap-2",
    head: "shrink-0",
    name: "",
    detail: "",
  },
};

/** One completion: a `/command` with its arguments over its description, else one line. */
export function MentionRow({
  option,
  selected,
  query,
  onPick,
}: {
  option: MentionOption;
  selected: boolean;
  query: string;
  onPick: (option: MentionOption) => void;
}) {
  const choice = option.kind === "choice";
  const label = choice ? option.insert : option.insert.slice(1);
  const slash = option.kind === "command" || option.kind === "skill";
  const look = LOOKS[slash ? "slash" : "line"];
  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        "flex cursor-default items-center rounded-md px-2",
        look.row,
        selected && "bg-accent text-accent-foreground",
      )}
      // Keeps focus (and the caret) in the text.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(option)}
    >
      <MentionIcon option={option} className={look.icon} />
      <div className={cn("flex min-w-0 flex-1", look.body)}>
        <div className={cn("flex items-center gap-1.5", look.head)}>
          <span className={cn("shrink-0", look.name)}>
            {!choice && option.insert[0]}
            <Highlight text={label} query={query} fuzzy={!choice} />
          </span>
          {option.args && <CommandArgs args={option.args} />}
        </div>
        {option.detail && (
          <span
            className={cn(
              "min-w-0 truncate text-muted-foreground",
              look.detail,
            )}
          >
            {option.detail}
          </span>
        )}
      </div>
    </div>
  );
}
