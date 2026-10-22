import type { SkillInfo } from "../../shared/skills";

/** One argument of a `/command`: its name, whether it may be left out, its fixed values, what it is. */
export type CommandArg = {
  name: string;
  optional: boolean;
  choices?: string[];
  description?: string;
};

/** The `/command` whose arguments the caret is in: the argument it's at and what's typed of it. */
export type ArgPlace = {
  name: string;
  args: CommandArg[];
  index: number;
  query: string;
  start: number;
  end: number;
};

/** A command's arguments, as its `argument-hint` names them (`[optional]`, `<required>` or a bare word; `a|b` for fixed values) and its descriptions say. */
export function commandArgs({
  argumentHint,
  argumentDescriptions,
}: Pick<SkillInfo, "argumentHint" | "argumentDescriptions">): CommandArg[] {
  const tokens = argumentHint?.match(/\[[^\]]*\]|<[^>]*>|\S+/g) ?? [];
  return tokens.map((token, i) => {
    const name = token.replace(/^[[<]|[\]>]$/g, "").trim();
    const choices = name
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const description = argumentDescriptions?.[i];
    return {
      name,
      optional: token.startsWith("["),
      ...(choices.length > 1 && { choices }),
      ...(description && { description }),
    };
  });
}

const lower = (s: string) => s.toLowerCase();

/** Whether `arg` is an optional fixed-values one that `word` (or, while `partial`, its start) isn't a value of. */
function leftOut(arg: CommandArg | undefined, word: string, partial: boolean) {
  if (!arg?.optional || !arg.choices) return false;
  const w = lower(word);
  return !arg.choices.some((c) =>
    partial ? lower(c).startsWith(w) : lower(c) === w,
  );
}

/** The argument `query` is in after `words`, the last one taking whatever follows; a word an optional value was left out for is the next argument's. */
function argIndex(args: CommandArg[], words: string[], query: string) {
  let index = 0;
  for (const word of words) index += leftOut(args[index], word, false) ? 2 : 1;
  if (query && leftOut(args[index], query, true)) index++;
  return Math.min(index, args.length - 1);
}

/** Where the caret is in the arguments of one of `commands` typed at the start of `text`, on its first line. */
export function argAt(
  text: string,
  caret: number,
  commands: SkillInfo[],
): ArgPlace | null {
  const head = /^\/(\S+)[ \t]+/.exec(text);
  if (!head || caret < head[0].length) return null;
  const typed = text.slice(head[0].length, caret);
  const command = commands.find((c) => c.name === head[1]);
  const args = commandArgs(command ?? {});
  if (!command || args.length === 0 || typed.includes("\n")) return null;
  const words = typed.split(/[ \t]+/);
  const query = words.pop()!;
  return {
    name: command.name,
    args,
    index: argIndex(args, words, query),
    query,
    start: caret - query.length,
    end: caret,
  };
}

/** The fixed values the argument at `place` can still become. */
export function argChoices(place: ArgPlace): string[] {
  const { choices } = place.args[place.index];
  const typed = lower(place.query);
  if (!choices) return [];
  return choices.filter(
    (c) => lower(c) !== typed && lower(c).startsWith(typed),
  );
}
