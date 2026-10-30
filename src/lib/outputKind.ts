/** How plain tool output shows: a lone link as a pill, markdown as a page, anything else as a terminal. */
type OutputKind = "url" | "markdown" | "terminal";

const URL_ONLY = /^https?:\/\/\S+$/;
const DIFF = /^(?:@@ |--- |\+\+\+ )/m;

// Each a different sign of markdown; one alone (a `#` comment, a dash list, a glob) is common in plain output.
const SIGNS = [
  /^#{1,6} \S/m,
  /^\s*(?:[-*+]|\d+\.) \S.*\n\s*(?:[-*+]|\d+\.) \S/m,
  /^(?:```|~~~)/m,
  /(?:^|\s)\*\*[^*\s][^*\n]*\*\*(?=[\s.,:;!?)]|$)/m,
  /\[[^\]\n]+\]\([^)\s]+\)/,
  /`[^`\n]+`[^`]*`[^`\n]+`/,
];

function isJson(text: string) {
  if (!/^[[{]/.test(text)) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** What `text` is, judged from its own shape; a single line is never markdown. */
export function outputKind(text: string): OutputKind {
  const trimmed = text.trim();
  if (URL_ONLY.test(trimmed)) return "url";
  if (!trimmed.includes("\n") || DIFF.test(trimmed) || isJson(trimmed)) {
    return "terminal";
  }
  const signs = SIGNS.filter((sign) => sign.test(trimmed)).length;
  return signs >= 2 ? "markdown" : "terminal";
}
