import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EffortSlider } from "@/components/agent/EffortSlider";
import { MENU_TRIGGER } from "@/components/agent/styles";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { EFFORT_LABELS } from "@/lib/modelMenu";

type Session = ReturnType<typeof useAgentSession>;
type SessionState = NonNullable<Session["state"]>;

/** Composer's effort picker, opening the effort slider in a dropdown. */
export function EffortMenu({
  state,
  session,
}: {
  state: SessionState;
  session: Session;
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
          onChange={(level) => void session.setThinkingLevel(level)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
