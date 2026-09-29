import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { SkillCatalog } from "../../../shared/skills";
import { AppIcon } from "@/components/mcp/AppIcon";
import { SkillSource } from "@/components/skills/SkillSource";
import { countOf } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** One app's skill folders and plugins, collapsed until opened. */
export function SkillAppGroup({
  app,
  sources,
  onImport,
}: {
  app: string;
  sources: SkillCatalog["sources"];
  onImport: (sourceId: string, names: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const skills = sources.flatMap((s) => s.skills);
  const added = skills.filter((s) => s.added).length;
  const plugins = sources.filter((s) => s.plugin).length;
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left text-[13px] hover:bg-muted/60"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        <AppIcon app={app} />
        {app}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {[
            plugins > 0 && countOf(plugins, "plugin"),
            countOf(skills.length, "skill"),
            added > 0 && `${added} added`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      {open && (
        <div className="divide-y border-t">
          {sources.map((source) => (
            <SkillSource key={source.id} source={source} onImport={onImport} />
          ))}
        </div>
      )}
    </div>
  );
}
