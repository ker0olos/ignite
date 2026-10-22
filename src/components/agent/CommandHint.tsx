import { CommandArgs } from "@/components/agent/CommandArgs";
import type { ArgPlace } from "@/lib/commandArgs";

/** The `/command` whose arguments are being typed, the current one lit and described. */
export function CommandHint({ place }: { place: ArgPlace }) {
  const arg = place.args[place.index];
  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-medium">/{place.name}</span>
        <CommandArgs args={place.args} current={place.index} />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {arg.optional ? "optional" : "required"}
        </span>
      </div>
      {arg.description && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {!arg.choices && (
            <span className="text-foreground">{arg.name} · </span>
          )}
          {arg.description}
        </div>
      )}
    </div>
  );
}
