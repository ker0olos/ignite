import type { DiffLine } from "@/lib/toolRows";
import { wordOps } from "@/lib/wordDiff";

// Private-use characters markdown leaves alone, so marks survive parsing in any block.
const mark = (n: number) => String.fromCharCode(0xe000 + n);
const INS = [mark(0), mark(1)] as const;
const DEL = [mark(2), mark(3)] as const;
const ANY_MARK = `[${mark(0)}-${mark(3)}]`;
const MARKS = new RegExp(ANY_MARK, "g");
const DELETED = new RegExp(`${DEL[0]}[^${DEL[1]}]*${DEL[1]}`, "g");
// A line's block markers (list item, heading, quote), kept outside its marks.
const LEAD = /^((?:\s*(?:[-*+]|\d+[.)]|#{1,6}|>)\s+)*)(.*)$/s;
const FENCE = /^\s*(?:`{3,}|~{3,})/;

function marked(text: string, [open, close]: readonly [string, string]) {
  if (!text.trim()) return text;
  const [, lead, rest] = LEAD.exec(text) ?? ["", "", text];
  return `${lead}${open}${rest}${close}`;
}

// A removed line and the added one in its place: one line with its words marked, else both whole.
// Words are compared after the block markers, so a changed marker or indent never lands inside a mark.
function merged(was: string, now: string): string[] {
  const [, wasLead, wasRest] = LEAD.exec(was) ?? ["", "", was];
  const [, lead, rest] = LEAD.exec(now) ?? ["", "", now];
  const ops = wasLead === lead ? wordOps(wasRest, rest) : null;
  if (!ops) return [marked(was, DEL), marked(now, INS)];
  const words = ops.map(({ op, text }) => {
    if (op === "same") return text;
    const [open, close] = op === "add" ? INS : DEL;
    return `${open}${text}${close}`;
  });
  return [lead + words.join("")];
}

const isFence = (text?: string) => text !== undefined && FENCE.test(text);

// A line only one side has; a fence can't be marked, so an added one shows as is and a removed one goes.
function alone(was?: string, now?: string): string[] {
  if (now !== undefined) return [isFence(now) ? now : marked(now, INS)];
  return was?.trim() && !isFence(was) ? [marked(was, DEL)] : [];
}

// One removed line and the added one in its place, either possibly missing.
function pair(was?: string, now?: string): string[] {
  if (was === undefined || now === undefined) return alone(was, now);
  if (isFence(was) !== isFence(now)) {
    return [...alone(was), ...alone(undefined, now)];
  }
  return isFence(now) ? [now] : merged(was, now);
}

const runEnd = (lines: DiffLine[], from: number, kind: DiffLine["kind"]) => {
  let i = from;
  while (lines[i]?.kind === kind) i++;
  return i;
};

const textOf = (line: DiffLine | undefined) =>
  line && line.kind !== "gap" ? line.text : undefined;

// A run of removed lines and the added ones after it, paired in order.
function changed(lines: DiffLine[], from: number, dels: number, adds: number) {
  const out: string[] = [];
  for (let k = 0; k < Math.max(dels - from, adds - dels); k++) {
    const was = k < dels - from ? textOf(lines[from + k]) : undefined;
    const now = k < adds - dels ? textOf(lines[dels + k]) : undefined;
    out.push(...pair(was, now));
  }
  return out;
}

// Code shows no marks: inside a fence, removed text goes and added text stays plain.
function unmarkFenced(lines: string[]) {
  let fenced = false;
  return lines.flatMap((line) => {
    if (FENCE.test(line)) fenced = !fenced;
    if (!fenced) return [line];
    const kept = line.replace(DELETED, "").replace(MARKS, "");
    return kept || !line ? [kept] : [];
  });
}

/** The new text of a diff as markdown, with what it adds and removes marked for `remarkRedline`. */
export function redline(lines: DiffLine[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const dels = runEnd(lines, i, "del");
    const adds = runEnd(lines, dels, "add");
    if (adds > i) {
      out.push(...changed(lines, i, dels, adds));
      i = adds;
    } else out.push(textOf(lines[i++]) ?? "");
  }
  return unmarkFenced(out).join("\n");
}

type Node = {
  type: string;
  value?: string;
  children?: Node[];
  data?: { hName?: string };
};

const OPENS: Record<string, "ins" | "del" | null> = {
  [INS[0]]: "ins",
  [INS[1]]: null,
  [DEL[0]]: "del",
  [DEL[1]]: null,
};

/** A remark plugin: `redline`'s marks become ins and del elements, also where a mark spans several nodes. */
export function remarkRedline() {
  return (tree: Node) => {
    let open: "ins" | "del" | null = null;
    const split = (value: string): Node[] =>
      value.split(new RegExp(`(${ANY_MARK})`)).flatMap((part) => {
        if (part in OPENS) {
          open = OPENS[part];
          return [];
        }
        if (!part) return [];
        const text: Node = { type: "text", value: part };
        return open
          ? [{ type: "emphasis", data: { hName: open }, children: [text] }]
          : [text];
      });
    // Code can't hold marks: its removed text goes, and inline code it adds to is marked whole.
    const unmark = (child: Node): Node[] => {
      const before = open;
      const kept = (child.value ?? "").replace(DELETED, "");
      for (const c of kept.match(MARKS) ?? []) open = OPENS[c];
      child.value = kept.replace(MARKS, "");
      const wrap = before ?? (kept.includes(INS[0]) ? "ins" : null);
      return child.type === "inlineCode" && wrap
        ? [{ type: "emphasis", data: { hName: wrap }, children: [child] }]
        : [child];
    };
    const walk = (node: Node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text") return split(child.value ?? "");
        if (child.value !== undefined) return unmark(child);
        walk(child);
        return [child];
      });
    };
    walk(tree);
  };
}
