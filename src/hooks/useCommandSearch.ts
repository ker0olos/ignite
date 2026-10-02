import { useEffect, useState } from "react";
import type { ConversationHit, FileHit } from "../../shared/conversations";
import { fuzzyScore } from "../../shared/fuzzy";
import type { HostClient } from "@/lib/piHost";
import { KIND_FILTERS, parseQuery, type ResultKind } from "@/lib/commandQuery";
import { basename } from "@/lib/paths";

const DEBOUNCE_MS = 100;

type Found = {
  key: string;
  conversations: ConversationHit[];
  files: FileHit[];
};

/** Completions for the `@` token being typed: kinds, then folders. */
function suggestionsFor(
  typing: ReturnType<typeof parseQuery>["typing"],
  folders: string[],
) {
  if (!typing) return [];
  const kinds = KIND_FILTERS.filter((f) =>
    f.token.startsWith(`@${typing.partial}`),
  ).map((f) => ({ token: f.token, label: f.label }));
  const named = folders
    .filter((f) => basename(f).toLowerCase().startsWith(typing.partial))
    .map((f) => ({ token: `@${basename(f)}`, label: f }));
  return [...kinds, ...named];
}

/**
 * What the command center finds for `query`: conversations and files from
 * the sidecar (asked as typing pauses), folders here, and completions for an
 * `@` token. A kind filter shows more of that kind.
 */
export function useCommandSearch(
  host: HostClient | null,
  query: string,
  folders: string[],
) {
  const parsed = parseQuery(query, folders);
  const wants = (k: ResultKind) => !parsed.kinds || parsed.kinds.includes(k);
  const limit = parsed.kinds ? 50 : 6;
  const scope = parsed.folder ? [parsed.folder] : folders;
  const kinds = (["conversation", "file"] as const).filter(wants);
  const key = JSON.stringify([parsed.text, scope, kinds, limit]);
  const [found, setFound] = useState<Found | null>(null);

  useEffect(() => {
    if (!host) return;
    const [text, folders, kinds, limit] = JSON.parse(key);
    const timer = setTimeout(() => {
      host
        .request({ type: "command_search", text, folders, kinds, limit })
        .then((r) => setFound({ key, ...r }))
        .catch(() => setFound({ key, conversations: [], files: [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [host, key]);

  const folderHits = wants("folder")
    ? scope
        .map((f) => [f, fuzzyScore(parsed.text, basename(f))] as const)
        .filter(([, s]) => s !== null)
        .sort((a, b) => b[1]! - a[1]!)
        .slice(0, limit)
        .map(([f]) => f)
    : [];

  return {
    /** What's searched for, without the @ and # filters. */
    text: parsed.text,
    suggestions: suggestionsFor(parsed.typing, folders),
    conversations: found?.conversations ?? [],
    files: found?.files ?? [],
    folders: folderHits,
    /** The shown results are for an older query. */
    loading: found?.key !== key,
  };
}
