import { ReflectionBasis } from "@/components/reflector/ReflectionBasis";
import { ReflectionTags } from "@/components/reflector/ReflectionTags";
import { ReflectionText } from "@/components/reflector/ReflectionText";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import { LearnedSource } from "@/components/settings/LearnedSource";
import type { Item } from "@/components/settings/sections";
import type { useReflector } from "@/hooks/useReflector";
import { noMatchItem } from "@/components/settings/sections/noMatchItem";
import { filterReflections } from "@/lib/learningFilters";
import { reflectionOrigin } from "@/lib/reflector";
import { ENTRY_POINTS, type Reflection } from "../../../../shared/reflector";

const origin = (r: Reflection) => {
  const { taught, ...rest } = reflectionOrigin(r);
  return { how: taught, ...rest };
};

/** Settings rows for the points the reflector learned about how the user wants the agent to work. */
export function reflectorItems({
  reflector,
  onOpenConversation,
}: {
  reflector: ReturnType<typeof useReflector>;
  onOpenConversation: (folder: string, conversation: string) => void;
}): Item[] {
  if (reflector.error) {
    return [
      {
        section: "Reflector",
        title: "Something went wrong",
        description: reflector.error,
      },
    ];
  }
  if (reflector.reflections?.length === 0) {
    return [
      {
        section: "Reflector",
        title: "Nothing learned yet",
        description:
          "Correct the agent, or add a note when you answer its questions, and what it learns lands here.",
      },
    ];
  }
  const shown = filterReflections(
    reflector.reflections ?? [],
    reflector.query,
    reflector.filter,
  );
  if (reflector.reflections?.length && shown.length === 0) {
    return [noMatchItem("Reflector", "No points match.")];
  }
  return shown
    .toSorted((a, b) => b.at - a.at)
    .map((r) => ({
      section: "Reflector",
      title: r.text,
      titleView: (
        <ReflectionText
          key={r.text}
          text={r.text}
          onSave={(t) => void reflector.edit(r.id, t)}
        />
      ),
      hint: (
        <>
          <ReflectionTags reflection={r} />
          <ReflectionBasis reflection={r} />
        </>
      ),
      id: `reflection-${r.id}`,
      alignTop: true,
      keywords: `reflector working style feedback preferences how to work ${ENTRY_POINTS[r.entry].label} ${r.when ?? ""}`,
      control: (
        <span className="flex items-start gap-5">
          <LearnedSource
            from={r.from}
            {...origin(r)}
            onOpenConversation={onOpenConversation}
          />
          <RemoveButton
            name="this point"
            onConfirm={() => void reflector.remove(r.id)}
            description="The agent no longer reads it, so it may work the old way again."
          />
        </span>
      ),
    }));
}
