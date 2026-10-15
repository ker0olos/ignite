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

// Outlives the command center, which mounts afresh on each open, so it opens
// on the last results while they refresh.
const cache = new Map<string, Found>();
const CACHED = 20;

function remember(found: Found) {
  cache.delete(found.key);
  cache.set(found.key, found);
  if (cache.size > CACHED) cache.delete(cache.keys().next().value!);
}

/** What `query` searches for, and its key. */
function searchFor(query: string, folders: string[]) {
  const parsed = parseQuery(query, folders);
  const wants = (k: ResultKind) => !parsed.kinds || parsed.kinds.includes(k);
  const limit = parsed.kinds ? 50 : 6;
  const scope = parsed.folder ? [parsed.folder] : folders;
  const kinds = (["conversation", "file"] as const).filter(wants);
  const key = JSON.stringify([parsed.text, scope, kinds, limit]);
  return { parsed, wants, limit, scope, key };
}

/** The sidecar's conversations and files for `key`, remembered; when it fails, what was last found, else none. */
async function fetchFound(host: HostClient, key: string): Promise<Found> {
  const [text, folders, kinds, limit] = JSON.parse(key);
  try {
    const r = await host.request({
      type: "command_search",
      text,
      folders,
      kinds,
      limit,
    });
    const found = { key, ...r };
    remember(found);
    return found;
  } catch {
    return cache.get(key) ?? { key, conversations: [], files: [] };
  }
}

/** Runs the command center's opening search ahead of time, so its first open shows results at once. */
export const prefetchCommandSearch = (host: HostClient, folders: string[]) =>
  fetchFound(host, searchFor("", folders).key);

/**
 * What the command center finds for `query`: conversations and files from
 * the sidecar (asked as typing pauses; meanwhile what it last found for the
 * same search), folders here, and completions for an `@` token. A kind
 * filter shows more of that kind.
 */
export function useCommandSearch(
  host: HostClient | null,
  query: string,
  folders: string[],
) {
  const { parsed, wants, limit, scope, key } = searchFor(query, folders);
  const [fetched, setFetched] = useState<Found | null>(null);
  const found = fetched?.key === key ? fetched : (cache.get(key) ?? fetched);

  useEffect(() => {
    if (!host) return;
    const timer = setTimeout(
      () => void fetchFound(host, key).then(setFetched),
      DEBOUNCE_MS,
    );
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
    /** The shown results are for an older query, or remembered and not yet refreshed. */
    loading: fetched?.key !== key,
  };
}
