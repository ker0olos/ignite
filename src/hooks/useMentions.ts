import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import type { FileHit } from "../../shared/conversations";
import type { SkillInfo } from "../../shared/skills";
import type { HostClient } from "@/lib/piHost";
import {
  insertMention,
  mentionAt,
  mentionOptions,
  type Mention,
  type MentionOption,
} from "@/lib/mentions";

const DEBOUNCE_MS = 100;

/** The folder's terminals, and files matching the `@` being typed (asked as typing pauses). */
function useMentionSources(
  host: HostClient | null,
  folder: string,
  mention: Mention | null,
) {
  const at = mention?.trigger === "@";
  const key = at ? JSON.stringify([folder, mention.query]) : null;
  const [found, setFound] = useState<{ key: string; files: FileHit[] }>();
  const [terminals, setTerminals] = useState<string[]>([]);

  useEffect(() => {
    if (!host || !key) return;
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
        .then((r) => setFound({ key, files: r.files }))
        .catch(() => setFound({ key, files: [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [host, key]);

  useEffect(() => {
    if (!host || !at) return;
    host
      .request({ type: "terminal_list", cwd: folder })
      .then((list) => setTerminals(list.map((t) => t.terminal)))
      .catch(() => setTerminals([]));
  }, [host, at, folder]);

  return { terminals, files: found?.key === key ? found.files : [] };
}

/**
 * The caret as the textarea last reported it, with the text it was in. Text
 * put back without a report (taken back from the queue) has no mention.
 */
function useCaret(text: string, input: RefObject<HTMLTextAreaElement | null>) {
  const [caret, setCaretAt] = useState({ text: "", at: 0 });
  const current = caret.text === text;
  const setCaret = (at: number) => {
    const text = input.current?.value ?? "";
    setCaretAt((c) => (c.text === text && c.at === at ? c : { text, at }));
  };
  const mention = current ? mentionAt(text, caret.at) : null;
  return { current, mention, setCaret, setCaretAt };
}

/** Esc closes the completions until another mention starts at a new place. */
function useDismissal(start: number | null, current: boolean) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  if (current && dismissed !== null && start !== dismissed) setDismissed(null);
  return {
    dismissed: dismissed !== null && dismissed === start,
    dismiss: () => setDismissed(start),
  };
}

/**
 * The composer's `/skill` and `@` completions at the caret: the session's
 * skills, attached images, the folder's terminals and files. ↑/↓ move,
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
}: {
  host: HostClient | null;
  folder: string;
  text: string;
  setText: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
  skills: SkillInfo[];
  images: number;
}) {
  const { current, mention, setCaret, setCaretAt } = useCaret(text, input);
  const sources = useMentionSources(host, folder, mention);
  const start = mention?.start ?? null;
  const query = mention?.query ?? "";
  // Both belong to the mention being typed; another one starts afresh.
  const at = `${start}:${query}`;
  const [selection, setSelection] = useState({ at, index: 0 });
  const selected = selection.at === at ? selection.index : 0;
  const { dismissed, dismiss } = useDismissal(start, current);

  const options: MentionOption[] =
    mention && !dismissed
      ? mentionOptions(mention, { skills, images, ...sources })
      : [];

  const pick = (option: MentionOption) => {
    const next = insertMention(text, mention!, option.insert);
    setText(next.text);
    setCaretAt({ text: next.text, at: next.caret });
    requestAnimationFrame(() =>
      input.current?.setSelectionRange(next.caret, next.caret),
    );
  };

  /** Handles a key while completions show; true when it was theirs. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (options.length === 0 || e.nativeEvent.isComposing) return false;
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const picks = (e.key === "Enter" || e.key === "Tab") && !e.shiftKey;
    if (move) {
      const index = (selected + move + options.length) % options.length;
      setSelection({ at, index });
    } else if (picks) pick(options[Math.min(selected, options.length - 1)]);
    else if (e.key === "Escape") dismiss();
    else return false;
    e.preventDefault();
    return true;
  };

  return {
    setCaret,
    onKeyDown,
    menu: { options, selected, query, onPick: pick },
  };
}
