/** A blockquote's markdown as written, between source offsets, with one level of `>` removed. */
export function quoteSource(markdown: string, start = 0, end = 0): string {
  return markdown
    .slice(start, end)
    .split("\n")
    .map((line) => line.replace(/^[ \t]*> ?/, ""))
    .join("\n")
    .trim();
}
