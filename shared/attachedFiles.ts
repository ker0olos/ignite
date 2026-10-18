/** A file attached to a message: its path, and its text when it was read in for the agent. */
export type SentFile = { path: string; text?: string };

const OPEN = "<attached_files>";
const CLOSE = "</attached_files>";
const INTRO = "Files the user attached:";
const BY_PATH = " (open it with your tools)";
const BLOCK = /(?:^|\n\n)<attached_files>\n([\s\S]*)\n<\/attached_files>$/;
const FENCE = /^`{3,}$/;

/** A fence longer than any backtick run in `text`. */
function fenceFor(text: string) {
  const longest = Math.max(
    2,
    ...(text.match(/`+/g) ?? []).map((m) => m.length),
  );
  return "`".repeat(longest + 1);
}

const block = ({ path, text }: SentFile, i: number) => {
  const header = `@file${i + 1}: ${path}`;
  if (text === undefined) return `${header}${BY_PATH}`;
  const fence = fenceFor(text);
  return [header, fence, text, fence].join("\n");
};

const HEADER = /^@file\d+: (.+)$/;

/** `message` with the files after it, named `@file1`, `@file2`… with their paths: their text inline, or only the path for the agent to open. */
export function withFiles(message: string, files: SentFile[]) {
  if (!files.length) return message;
  const body = [OPEN, INTRO, "", files.map(block).join("\n\n"), CLOSE].join(
    "\n",
  );
  return message.trim() ? `${message.trimEnd()}\n\n${body}` : body;
}

/** The file whose header is at `lines[at]`, and the line after it; null when none starts there. */
function readOne(lines: string[], at: number) {
  const named = HEADER.exec(lines[at] ?? "")?.[1];
  if (!named) return null;
  if (named.endsWith(BY_PATH)) {
    const path = named.slice(0, -BY_PATH.length);
    return { file: { path }, next: at + 1 };
  }
  const fence = lines[at + 1];
  if (!FENCE.test(fence ?? "")) return null;
  const close = lines.indexOf(fence, at + 2);
  if (close < 0) return null;
  const text = lines.slice(at + 2, close).join("\n");
  return { file: { path: named, text }, next: close + 1 };
}

/** A message's own text and the files it carries; none when it carries none, or they don't read back. */
export function readFiles(message: string): {
  text: string;
  files: SentFile[];
} {
  const m = BLOCK.exec(message);
  const lines = m?.[1].split("\n") ?? [];
  if (lines[0] !== INTRO) return { text: message, files: [] };
  const files: SentFile[] = [];
  for (let at = 2; at < lines.length;) {
    if (lines[at] === "") {
      at++;
      continue;
    }
    const one = readOne(lines, at);
    if (!one) return { text: message, files: [] };
    files.push(one.file);
    at = one.next;
  }
  return { text: message.slice(0, m!.index).trimEnd(), files };
}
