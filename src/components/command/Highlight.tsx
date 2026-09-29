import { matchRanges } from "../../../shared/fuzzy";

/**
 * `text` with where `query` matched it marked; `fuzzy` also marks scattered
 * letters. `ranges` marks given places instead, `offset` places into `text`.
 */
export function Highlight({
  text,
  query = "",
  fuzzy = false,
  ranges,
  offset = 0,
}: {
  text: string;
  query?: string;
  fuzzy?: boolean;
  ranges?: [number, number][];
  offset?: number;
}) {
  const marks = (ranges ?? matchRanges(query, text, fuzzy))
    .map(([s, e]) => [
      Math.max(s - offset, 0),
      Math.min(e - offset, text.length),
    ])
    .filter(([s, e]) => s < e);
  if (!marks.length) return text;
  const parts = [];
  let from = 0;
  for (const [start, end] of marks) {
    parts.push(text.slice(from, start));
    parts.push(
      <mark
        key={start}
        className="rounded-[2px] bg-warning/35 text-inherit dark:bg-warning/30"
      >
        {text.slice(start, end)}
      </mark>,
    );
    from = end;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}
