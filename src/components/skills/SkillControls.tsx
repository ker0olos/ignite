import type { PluginSkill } from "../../../shared/skills";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import { SkillAlwaysMenu } from "@/components/skills/SkillAlwaysMenu";
import { Switch } from "@/components/ui/switch";

/** A skill row's always-on menu, switch and remove button. */
export function SkillControls({
  name,
  enabled,
  skills,
  onEnabledChange,
  onAlwaysChange,
  onRemove,
}: {
  name: string;
  enabled: boolean;
  /** The row's skill, or a plugin's skills. */
  skills: PluginSkill[];
  onEnabledChange: (enabled: boolean) => void;
  onAlwaysChange: (id: string, always: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {enabled && (
        <SkillAlwaysMenu
          name={name}
          skills={skills}
          onAlwaysChange={onAlwaysChange}
        />
      )}
      <RemoveButton
        name={name}
        onConfirm={onRemove}
        description="The agent can no longer use it. You can import it again anytime."
      />
      <Switch
        className="ml-2"
        aria-label={`Use ${name}`}
        checked={enabled}
        onCheckedChange={onEnabledChange}
      />
    </div>
  );
}
