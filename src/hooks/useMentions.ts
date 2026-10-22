import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import type { FileHit } from "../../shared/conversations";
import type { SkillInfo } from "../../shared/skills";
import type { HostClient } from "@/lib/piHost";
import { argAt, argChoices, type ArgPlace } from "@/lib/commandArgs";
import {
  insertMention,
  mentionAt,
  mentionOptions,
  slashCommands,
  type Mention,
  type MentionOption,
} from "@/lib/mentions";

const DEBOUNCE_MS = 100;

/** The folder's terminals, and files matching the `@` being typed (asked as typing pauses; the last ones show meanwhile). */
function useMentionSources(
  host: HostClient | null,
  folder: string,
  mention: Mention | null,
) {
  const at = mention?.trigger === "@";
  const key = at ? JSON.stringify([folder, mention.query]) : null;
  // The `@` being typed, whatever its query: its earlier results stand in until the new ones come.
  const place = at ? `${folder}:${mention.start}` : null;
  const [found, setFound] = useState<{
    key: string;
    place: string;
    files: FileHit[];
  }>();
  const [terminals, setTerminals] = useState<string[]>([]);

  useEffect(() => {
    if (!host || !key || !place) return;
    const [folder, query] = JSON.parse(key);
    const timer = setTimeout(() => {
      host
        .request({
          type: "command_search",
          text: query,
          folders: [folder],
          kinds: ["file"],
          limit: 8,
        })
        .then((r) => setFound({ key, place, files: r.files }))
        .catch(() => setFound({ key, place, files: [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [host, key, place]);

  useEffect(() => {
    if (!host || !at) return;
    host
      .request({ type: "terminal_list", cwd: folder })
      .then((list) => setTerminals(list.map((t) => t.name)))
      .catch(() => setTerminals([]));
  }, [host, at, folder]);

  return { terminals, files: found?.place === place ? found.files : [] };
}

/**
 * The caret as the textarea last reported it, with the text it was in, and
 * the mention or `/command` argument there. Text put back without a report
 * (taken back from the queue) has neither.
 */
function useCaret(
  text: string,
  input: RefObject<HTMLTextAreaElement | null>,
  skills: SkillInfo[],
) {
  const [caret, setCaretAt] = useState({ text: "", at: 0 });
  const current = caret.text === text;
  const setCaret = (at: number) => {
    const text = input.current?.value ?? "";
    setCaretAt((c) => (c.text === text && c.at === at ? c : { text, at }));
  };
  const mention = current ? mentionAt(text, caret.at) : null;
  const arg = current ? argAt(text, caret.at, slashCommands(skills)) : null;
  return { current, mention, arg, setCaret, setCaretAt };
}

/** Esc closes what `key` names until another key comes: a mention's list, or a command's hint and values. */
function useDismissal(key: string | null, current: boolean) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (current && dismissed !== null && key !== dismissed) setDismissed(null);
  return {
    dismissed: dismissed !== null && dismissed === key,
    dismiss: () => setDismissed(key),
  };
}

/** A mention's list and a command's hint close apart: Esc closes the mention's while one is typed. */
function useDismissals(
  mention: Mention | null,
  arg: ArgPlace | null,
  current: boolean,
) {
  const mentions = useDismissal(mention && `${mention.start}`, current);
  const args = useDismissal(arg && arg.name, current);
  return {
    mentionGone: mentions.dismissed,
    argGone: args.dismissed,
    dismiss: mention ? mentions.dismiss : args.dismiss,
  };
}

/** The highlighted completion, kept while the same mention is typed; none at first where `unpicked`. */
function useSelection(at: string, unpicked: boolean) {
  const [selection, setSelection] = useState({ at, index: 0 });
  const selected = selection.at === at ? selection.index : unpicked ? -1 : 0;
  return { selected, select: (index: number) => setSelection({ at, index }) };
}

/** The mention's completions, else the values of the `/command` argument being typed. */
function completions(
  mention: Mention | null,
  arg: ArgPlace | null,
  found: Parameters<typeof mentionOptions>[1],
): MentionOption[] {
  if (mention) return mentionOptions(mention, found);
  return arg
    ? argChoices(arg).map((insert) => ({ kind: "choice", insert }))
    : [];
}
/**
 * The composer's `/skill` and `@` completions at the caret: the session's
 * skills, attached images and files, the folder's terminals and files. ↑/↓ move,
 * ↵ or ⇥ picks, esc closes.
 */
export function useMentions({
  host,
  folder,
  text,
  setText,
  input,
  skills,
  images,
  imageNames,
  attached,
}: {
  host: HostClient | null;
  folder: string;
  text: string;
  setText: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
  skills: SkillInfo[];
  images: number;
  /** What each attached image is shown as in the menu. */
  imageNames?: string[];
  /** The names of the files attached to the message, offered as `@file1`… */
  attached?: string[];
}) {
  const { current, mention, arg, setCaret, setCaretAt } = useCaret(
    text,
    input,
    skills,
  );
  const sources = useMentionSources(host, folder, mention);
  const place = mention ?? arg;
  const start = place?.start ?? null;
  const query = place?.query ?? "";
  // An argument's values show unpicked until one is typed, so ↵ still sends.
  const { selected, select } = useSelection(
    `${start}:${query}`,
    !mention && !query,
  );
  const { mentionGone, argGone, dismiss } = useDismissals(
    mention,
    arg,
    current,
  );
  const hint = argGone ? null : arg;

  const options = mentionGone
    ? []
    : completions(mention, hint, {
        skills,
        images,
        imageNames,
        attached,
        ...sources,
      });

  const pick = (option: MentionOption) => {
    const next = insertMention(text, place!, option.insert);
    setText(next.text);
    setCaretAt({ text: next.text, at: next.caret });
    requestAnimationFrame(() =>
      input.current?.setSelectionRange(next.caret, next.caret),
    );
  };

  /** ↑/↓ and ↵ or ⇥ in the options; true when the key was theirs. */
  const listKey = (e: KeyboardEvent) => {
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const picks =
      ((e.key === "Enter" && selected >= 0) || e.key === "Tab") && !e.shiftKey;
    const n = options.length;
    if (move) {
      // From unpicked, ↓ goes to the first and ↑ to the last.
      const from = Math.max(selected, move > 0 ? -1 : 0);
      select((from + move + n) % n);
    } else if (picks) pick(options[Math.max(0, Math.min(selected, n - 1))]);
    else return false;
    return true;
  };

  /** Handles a key while completions or the hint show; true when it was theirs. */
  const onKeyDown = (e: KeyboardEvent) => {
    const showing = options.length > 0 || hint !== null;
    if (!showing || e.nativeEvent.isComposing) return false;
    if (e.key === "Escape") {
      dismiss();
      // Only the passive hint closed: Esc still reaches the composer (stopping a run).
      if (options.length === 0) return false;
    } else if (options.length === 0 || !listKey(e)) return false;
    e.preventDefault();
    return true;
  };

  return {
    setCaret,
    onKeyDown,
    menu: { options, selected, query, onPick: pick, hint },
  };
}
