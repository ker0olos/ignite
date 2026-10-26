import { GraduationCap, Lightbulb, ListChecks } from "lucide-react";
import type { Item } from "@/components/settings/sections";
import { learningSwitchItem } from "@/components/settings/sections/learningSwitchItem";
import type { Settings } from "@/lib/settings";

const icon = "size-4 shrink-0 text-muted-foreground";

/** The Lessons, Procedures and Reflector sections' switches, each first in its section. */
export function learningItems({
  settings,
  onChange,
  onLessonsChanged,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void | Promise<void>;
  /** Lesson tools come and go only as conversations reload. */
  onLessonsChanged: () => Promise<void>;
}): Item[] {
  const { lessons, reflector, procedures, memory } = settings;
  return [
    learningSwitchItem({
      section: "Lessons",
      icon: <GraduationCap className={icon} />,
      description: lessons.enabled
        ? "The agent saves a lesson when you correct it, and is held to it in later conversations."
        : "Off: no lessons are saved, and the ones below aren't read or enforced.",
      keywords: "lessons mistakes corrections turn off disable",
      checked: lessons.enabled,
      onCheckedChange: async (on) => {
        await onChange({ ...settings, lessons: { enabled: on } });
        await onLessonsChanged();
      },
    }),
    learningSwitchItem({
      section: "Procedures",
      icon: <ListChecks className={icon} />,
      description: !memory.enabled
        ? "Needs Memory on: procedures are kept with the memory."
        : procedures.enabled
          ? "Records how conversations got past failed commands, and offers them to new ones that need them."
          : "Off: none are recorded, and the ones below aren't offered.",
      keywords: "procedures fixes failed commands turn off disable",
      checked: procedures.enabled,
      onCheckedChange: (on) =>
        onChange({ ...settings, procedures: { enabled: on } }),
    }),
    learningSwitchItem({
      section: "Reflector",
      icon: <Lightbulb className={icon} />,
      description: reflector.enabled
        ? "Learns how you want the agent to work from your feedback, and every new conversation reads it."
        : "Off: nothing new is learned, and the points below aren't read.",
      keywords: "reflector feedback working style turn off disable",
      checked: reflector.enabled,
      onCheckedChange: (on) =>
        onChange({ ...settings, reflector: { enabled: on } }),
    }),
  ];
}
