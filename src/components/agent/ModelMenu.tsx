import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { ModelGroups } from "@/components/agent/ModelGroups";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { modelLabel, modelMenu } from "@/lib/modelMenu";

type Session = ReturnType<typeof useAgentSession>;
type SessionState = NonNullable<Session["state"]>;

/** Composer's model picker: featured models, with the rest under "More models". */
export function ModelMenu({
  state,
  session,
}: {
  state: SessionState;
  session: Session;
}) {
  const { featured, more } = modelMenu(state.models);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {state.model ? modelLabel(state.model) : "Choose a model"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <ModelGroups
          groups={featured}
          current={state.model}
          onSelect={session.setModel}
        />
        {more.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More models</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                <ModelGroups
                  groups={more}
                  current={state.model}
                  onSelect={session.setModel}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
