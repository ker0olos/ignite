import { CommandHint } from "@/components/agent/CommandHint";
import { MentionRow } from "@/components/agent/MentionRow";
import type { ArgPlace } from "@/lib/commandArgs";
import type { MentionOption } from "@/lib/mentions";

/** The composer's completions for the `/skill`, its argument or `@mention` being typed, above the text. */
export function MentionMenu({
  options,
  selected,
  query,
  onPick,
  hint,
}: {
  options: MentionOption[];
  selected: number;
  query: string;
  onPick: (option: MentionOption) => void;
  /** The `/command` whose arguments are being typed. */
  hint: ArgPlace | null;
}) {
  if (options.length === 0 && !hint) return null;
  return (
    <div className="absolute inset-x-4 bottom-full z-10 mb-1 overflow-hidden rounded-lg border bg-popover p-1 text-[13px] text-popover-foreground shadow-md">
      {hint && <CommandHint place={hint} />}
      {options.length > 0 && (
        <div role="listbox" aria-label="Suggestions">
          {options.map((option, i) => (
            <MentionRow
              key={option.insert}
              option={option}
              selected={i === selected}
              query={query}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
