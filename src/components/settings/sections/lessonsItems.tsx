import { LessonTags } from "@/components/lessons/LessonTags";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import type { Item } from "@/components/settings/sections";
import type { useLessons } from "@/hooks/useLessons";
import { lessonScope } from "@/lib/lessons";
import { lessonTool } from "../../../../shared/lessons";

/** Settings rows for the lessons the agent saved from its mistakes. */
export function lessonsItems({
  lessons,
}: {
  lessons: ReturnType<typeof useLessons>;
}): Item[] {
  if (lessons.error) {
    return [
      {
        section: "Lessons",
        title: "Something went wrong",
        description: lessons.error,
      },
    ];
  }
  if (lessons.lessons?.length === 0) {
    return [
      {
        section: "Lessons",
        title: "No lessons yet",
        description: "The agent saves one when you correct it.",
      },
    ];
  }
  return (lessons.lessons ?? []).map((l) => ({
    section: "Lessons",
    title: l.text,
    hint: <LessonTags lesson={l} hits={l.hits} />,
    keywords: `lesson mistake correction rule ${lessonScope(l.folder)} ${lessonTool(l) ?? ""} ${l.match ?? ""}`,
    control: (
      <RemoveButton
        name="this lesson"
        onConfirm={() => void lessons.remove(l.id)}
        description="The agent no longer reads it, so it may make this mistake again."
      />
    ),
  }));
}
