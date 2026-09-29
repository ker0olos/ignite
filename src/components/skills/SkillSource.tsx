import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { SkillCatalog } from "../../../shared/skills";
import { Added } from "@/components/mcp/Added";
import { AsyncButton } from "@/components/mcp/AsyncButton";
import { countOf } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** A skills folder or plugin: import it whole, or open it to pick skills. */
export function SkillSource({
  source,
  onImport,
}: {
  source: SkillCatalog["sources"][number];
  onImport: (sourceId: string, names: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const missing = source.skills.filter((s) => !s.added).map((s) => s.name);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-1.5 pr-3 pl-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 items-center gap-2 text-left text-[13px]"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate">
            {source.plugin ? source.label : "Skills folder"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {source.plugin && "Plugin · "}
            {countOf(source.skills.length, "skill")}
          </span>
        </button>
        {missing.length > 0 ? (
          <AsyncButton onClick={() => onImport(source.id, missing)}>
            {missing.length === source.skills.length
              ? "Import"
              : `Import ${missing.length}`}
          </AsyncButton>
        ) : (
          <Added />
        )}
      </div>
      {open && (
        <div className="mb-2 ml-9 divide-y border-l">
          {source.skills.map((skill) => (
            <div
              key={skill.name}
              className="flex items-center justify-between gap-3 py-1.5 pr-3 pl-4"
            >
              <div className="min-w-0">
                <p className="text-[13px]">{skill.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {skill.description}
                </p>
              </div>
              {skill.added ? (
                <Added />
              ) : (
                <AsyncButton onClick={() => onImport(source.id, [skill.name])}>
                  Import
                </AsyncButton>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
