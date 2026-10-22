import type { CommandArg } from "@/lib/commandArgs";
import { cn } from "@/lib/utils";

/** A `/command`'s arguments as chips, the one being typed (`current`) lit. */
export function CommandArgs({
  args,
  current,
}: {
  args: CommandArg[];
  current?: number;
}) {
  return args.map((arg, i) => (
    <span
      key={i}
      className={cn(
        "shrink-0 rounded bg-foreground/8 px-1.5 py-px text-xs",
        arg.optional && "text-muted-foreground",
        i === current && "bg-primary text-primary-foreground",
      )}
    >
      {arg.choices?.join(" | ") ?? arg.name}
    </span>
  ));
}
