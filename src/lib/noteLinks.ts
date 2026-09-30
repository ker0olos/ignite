export type NoteLink = { url: string; label: string };

/** A short label for a link: "repo#21" for a GitHub issue or pull request, else the host and path. */
export function linkLabel(url: string) {
  const gh =
    /^https?:\/\/github\.com\/[^/]+\/([^/]+)\/(?:issues|pull)\/(\d+)/.exec(url);
  if (gh) return `${gh[1]}#${gh[2]}`;
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return u.host + path;
  } catch {
    return url;
  }
}

/** Notes split into their links (with short labels) and the remaining text. */
export function splitNotes(notes: string): { links: NoteLink[]; text: string } {
  const links: NoteLink[] = [];
  const text = notes
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      links.push({ url, label: linkLabel(url) });
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { links, text };
}
