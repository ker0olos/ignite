// http(s) URLs; trailing punctuation belongs to the sentence, not the link.
const URL = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/g;

/** Text split into plain runs and URLs, in order. */
export function splitLinks(text: string): { text: string; url?: boolean }[] {
  const parts: { text: string; url?: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], url: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
