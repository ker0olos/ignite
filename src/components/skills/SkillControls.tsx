import { RemoveButton } from "@/components/mcp/RemoveButton";
import { Switch } from "@/components/ui/switch";

/** A skill row's switch and remove button. */
export function SkillControls({
  name,
  enabled,
  onEnabledChange,
  onRemove,
}: {
  name: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
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
