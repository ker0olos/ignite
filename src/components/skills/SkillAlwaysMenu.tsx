import { Pin } from "lucide-react";
import type { PluginSkill } from "../../../shared/skills";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Which of a row's skills are always on: their whole text in every prompt. */
export function SkillAlwaysMenu({
  name,
  skills,
  onAlwaysChange,
}: {
  name: string;
  skills: PluginSkill[];
  onAlwaysChange: (id: string, always: boolean) => void;
}) {
  const on = skills.filter((s) => s.always).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Always on: ${name}`}
            title={on ? `${on} always on` : "Always on"}
          />
        }
      >
        <Pin className={on ? "fill-current" : "text-muted-foreground"} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            Always on: in every conversation, not only when it fits
          </DropdownMenuLabel>
          {skills.map((skill) => (
            <DropdownMenuCheckboxItem
              key={skill.id}
              checked={skill.always}
              onClick={() => onAlwaysChange(skill.id, !skill.always)}
            >
              <span className="truncate">{skill.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
