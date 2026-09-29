import { MemoryPreview } from "@/components/memory/MemoryPreview";
import type { useMemory } from "@/hooks/useMemory";

/** The Memory section's extras: a preview of the folder's recent memories. */
export function MemoryExtras({
  memory,
  folder,
}: {
  memory: ReturnType<typeof useMemory>;
  folder: string | null;
}) {
  if (!memory.status?.viewerUrl) return null;
  return <MemoryPreview folder={folder} status={memory.status} />;
}
