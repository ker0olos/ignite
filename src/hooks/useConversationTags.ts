import { useCallback, useEffect, useRef, useState } from "react";
import { withTagsFor, type ConversationTags } from "@/lib/conversationTags";
import { onStoreChange, store } from "@/lib/store";

/**
 * Tags by conversation id, shared by all windows and kept after a
 * conversation closes, so reopening it shows them again; and the tags the
 * sidebar is filtered to.
 */
export function useConversationTags() {
  const [map, setMap] = useState<ConversationTags>({});
  const [filter, setFilter] = useState<string[]>([]);
  const latest = useRef<ConversationTags>({});

  const show = useCallback((next: ConversationTags) => {
    latest.current = next;
    setMap(next);
  }, []);

  useEffect(() => {
    void store.then(async (s) => {
      show((await s.get<ConversationTags>("conversation_tags")) ?? {});
    });
    const unlisten = onStoreChange((key, value) => {
      if (key === "conversation_tags")
        show((value as ConversationTags | undefined) ?? {});
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [show]);

  const setTags = useCallback(
    (session: string, tags: readonly string[]) => {
      const next = withTagsFor(latest.current, session, tags);
      show(next);
      void store.then((s) => s.set("conversation_tags", next));
    },
    [show],
  );

  const toggleFilter = useCallback((tag: string) => {
    setFilter((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }, []);

  const clearFilter = useCallback(() => setFilter([]), []);

  return { map, filter, setTags, toggleFilter, clearFilter };
}
