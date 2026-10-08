import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TodoItem } from "../shared/tasks.ts";

const ITEM = /^(?:\d+\.|[-*])\s+(.*)$/;
const HEADING = /^##\s+(.*)$/;
const BOLD = /^\*\*(.+?)\*\*[.:]?\s*(.*)$/;
const CLOSED = /^(?:~~|(?:FIXED|CLOSED|DONE)\b)/;

// Wrapped lines join into one; a nested item, or a blank line, starts a new one.
function prose(lines: string[]) {
  const out: string[] = [];
  let joinable = false;
  for (const line of lines.map((l) => l.trim())) {
    if (!line) joinable = false;
    else if (joinable && !ITEM.test(line)) out[out.length - 1] += ` ${line}`;
    else {
      out.push(line);
      joinable = true;
    }
  }
  return out.join("\n");
}

function toItem(lines: string[], section?: string): Omit<TodoItem, "folder"> {
  const [first, ...rest] = lines;
  const bold = BOLD.exec(first);
  if (bold) {
    const [, title, after] = bold;
    const notes = prose([after.replace(/^[,;]\s*/, ""), ...rest]);
    return { title: title.replace(/[.:]$/, ""), notes, section };
  }
  const text = prose(lines);
  const end = /[.!?](\s|$)|\n/.exec(text);
  const cut = end ? end.index + 1 : text.length;
  return {
    title: text.slice(0, cut).trim(),
    notes: text.slice(cut).trim(),
    section,
  };
}

type Parsed = Omit<TodoItem, "folder"> & { start: number; end: number };

// Each item with the lines it spans, `end` exclusive and past no trailing blank line.
function parse(text: string): Parsed[] {
  const items: Parsed[] = [];
  let section: string | undefined;
  let lines: string[] | null = null;
  let start = 0;
  const flush = () => {
    if (lines && !CLOSED.test(lines[0].replace(/^\*\*/, ""))) {
      const item = toItem(lines, section);
      let end = start + lines.length;
      while (end > start + 1 && !lines[end - start - 1].trim()) end--;
      if (!CLOSED.test(item.notes)) items.push({ ...item, start, end });
    }
    lines = null;
  };
  text.split(/\r?\n/).forEach((line, i) => {
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    if (heading) {
      flush();
      section = heading[1].trim();
    } else if (item) {
      flush();
      lines = [item[1]];
      start = i;
    } else if (lines && (/^\s/.test(line) || !line.trim())) {
      lines.push(line);
    } else flush();
  });
  flush();
  return items;
}

/** A .todo file's open items: each top-level list item under its `##` section, wrapped lines joined; struck-through, CLOSED, FIXED or DONE ones left out. */
export const parseTodo = (text: string): Omit<TodoItem, "folder">[] =>
  parse(text).map(({ title, notes, section }) => ({ title, notes, section }));

const readTodo = (path: string) => readFile(path, "utf8").catch(() => null);

/** The open items of `cwd`'s .todo and of each folder's directly in it. */
export async function readTodos(cwd: string): Promise<TodoItem[]> {
  const dirs = await readdir(cwd, { withFileTypes: true }).catch(() => []);
  const folders = [
    "",
    ...dirs
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort(),
  ];
  const texts = await Promise.all(
    folders.map((r) => readTodo(join(cwd, r, ".todo"))),
  );
  return folders.flatMap((folder, i) =>
    texts[i] === null
      ? []
      : parseTodo(texts[i]).map((item) => ({ ...item, folder })),
  );
}

/** Removes `item`'s lines from its .todo file, then reads the items again; one no longer in the file changes nothing. */
export async function deleteTodo(cwd: string, item: TodoItem) {
  const path = join(cwd, item.folder, ".todo");
  const text = await readTodo(path);
  const found = text
    ? parse(text).find(
        (p) => p.title === item.title && p.section === item.section,
      )
    : undefined;
  if (text && found) {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r?\n/);
    lines.splice(found.start, found.end - found.start);
    await writeFile(path, lines.join(eol));
  }
  return readTodos(cwd);
}
