import type { Item } from "@/components/settings/sections";
import { learningItems } from "@/components/settings/sections/learningItems";
import { lessonsItems } from "@/components/settings/sections/lessonsItems";
import { memoryItems } from "@/components/settings/sections/memoryItems";
import { proceduresItems } from "@/components/settings/sections/proceduresItems";
import { reflectorItems } from "@/components/settings/sections/reflectorItems";
import type { useLessons } from "@/hooks/useLessons";
import type { useMemory } from "@/hooks/useMemory";
import type { useProcedures } from "@/hooks/useProcedures";
import type { useReflector } from "@/hooks/useReflector";
import type { Settings } from "@/lib/settings";

// Settings' own search goes through every row, whatever a tab's search and chip hide.
const own = <T extends object>(hook: T, searching: boolean): T =>
  searching ? { ...hook, query: "", filter: null } : hook;

/** The rows of the Learning tabs: memory, lessons, procedures and the reflector; while Settings is searched, without the tabs' own filters. */
export function learningSectionItems(
  hooks: {
    memory: ReturnType<typeof useMemory>;
    lessons: ReturnType<typeof useLessons>;
    procedures: ReturnType<typeof useProcedures>;
    reflector: ReturnType<typeof useReflector>;
  },
  {
    settings,
    onChange,
    onOpenConversation,
    folder,
    query,
  }: {
    settings: Settings;
    onChange: (settings: Settings) => void | Promise<void>;
    onOpenConversation: (folder: string, conversation: string) => void;
    /** The open folder, if any. */
    folder: string | null;
    /** What's typed in Settings' own search. */
    query: string;
  },
): Item[] {
  const { memory } = hooks;
  const folderOpen = !!folder;
  const searching = query.trim() !== "";
  const lessons = own(hooks.lessons, searching);
  const procedures = own(hooks.procedures, searching);
  const reflector = own(hooks.reflector, searching);
  return [
    ...memoryItems({ memory, folderOpen, settings, onChange }),
    // Before the sections' own rows, so each switch comes first in its section.
    ...learningItems({
      settings,
      onChange,
      onLessonsChanged: memory.changed,
    }),
    ...lessonsItems({ lessons }),
    ...proceduresItems({ procedures, onOpenConversation, searching }),
    ...reflectorItems({ reflector, onOpenConversation }),
  ];
}
