import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EffortSlider } from "@/components/agent/EffortSlider";
import { MENU_TRIGGER } from "@/components/agent/styles";
import type { SessionState, ThinkingLevel } from "../../../shared/hostProtocol";
import { EFFORT_LABELS } from "@/lib/modelMenu";

/** Effort picker (composer, new-task sheet), opening the effort slider in a dropdown. */
export function EffortMenu({
  state,
  onChange,
}: {
  state: SessionState;
  onChange: (level: ThinkingLevel) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {EFFORT_LABELS[state.thinkingLevel]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-auto">
        <EffortSlider
          levels={state.thinkingLevels}
          value={state.thinkingLevel}
          onChange={onChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
