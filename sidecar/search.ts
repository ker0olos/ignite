import type {
  CommandSearch,
  CommandSearchResult,
} from "../shared/conversations.ts";
import { rankConversations, rankFiles } from "../shared/commandSearch.ts";
import type { SessionStore } from "./hostTypes.ts";

function cached<T>(load: (folder: string) => Promise<T>, ttl: number) {
  const kept = new Map<string, { at: number; value: Promise<T> }>();
  return (folder: string) => {
    const hit = kept.get(folder);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    const value = load(folder).catch((error: unknown) => {
      kept.delete(folder);
      throw error;
    });
    kept.set(folder, { at: Date.now(), value });
    return value;
  };
}

/**
 * The command center's search over folders' conversations and files, each
 * folder's lists kept a short while so typing doesn't reread them.
 */
export function createSearch(
  sessions: Pick<SessionStore, "list">,
  files: (folder: string) => Promise<string[]>,
) {
  const conversationsOf = cached(sessions.list, 15_000);
  const filesOf = cached(files, 60_000);
  const each = async <T>(
    folders: string[],
    load: (folder: string) => Promise<T[]>,
  ) =>
    Promise.all(
      folders.map(
        async (f) => [f, await load(f).catch(() => [])] as [string, T[]],
      ),
    );

  return async (request: CommandSearch): Promise<CommandSearchResult> => {
    const { text, folders, kinds, limit } = request;
    const [conversations, fileLists] = await Promise.all([
      kinds.includes("conversation") ? each(folders, conversationsOf) : [],
      kinds.includes("file") && text ? each(folders, filesOf) : [],
    ]);
    return {
      conversations: rankConversations(conversations, text, limit),
      files: rankFiles(fileLists, text, limit),
    };
  };
}
