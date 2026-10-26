import type { MemoryStatus } from "../../shared/memory";
import type { LearningTab } from "@/components/settings/sections";
import type { Settings } from "@/lib/settings";

export interface LearningTabInfo {
  tab: LearningTab;
  count?: number;
  on: boolean;
}

/** The Learning tabs' counts (undefined until loaded; Memory's until a folder is open, as it counts that folder's) and whether each part is switched on. */
export function learningTabs(
  settings: Pick<Settings, "memory" | "lessons" | "procedures" | "reflector">,
  {
    memory,
    lessons,
    procedures,
    reflector,
  }: {
    memory: { status: MemoryStatus | null };
    lessons: { lessons: unknown[] | null };
    procedures: { procedures: unknown[] | null };
    reflector: { reflections: unknown[] | null };
  },
  folder: string | null,
): LearningTabInfo[] {
  const memoryOn = settings.memory.enabled;
  return [
    {
      tab: "Memory",
      count:
        memory.status && folder
          ? Object.values(memory.status.counts).reduce((a, b) => a + b, 0)
          : undefined,
      on: memoryOn,
    },
    {
      tab: "Lessons",
      count: lessons.lessons?.length,
      on: settings.lessons.enabled,
    },
    {
      tab: "Procedures",
      count: procedures.procedures?.length,
      on: settings.procedures.enabled && memoryOn,
    },
    {
      tab: "Reflector",
      count: reflector.reflections?.length,
      on: settings.reflector.enabled,
    },
  ];
}
