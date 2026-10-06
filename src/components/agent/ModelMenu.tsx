import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelInfo, SessionState } from "../../../shared/hostProtocol";
import { ModelGroups } from "@/components/agent/ModelGroups";
import { ModelRouterItem } from "@/components/agent/ModelRouterItem";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { modelMenu, modelTriggerLabel } from "@/lib/modelMenu";

/** Model picker (composer, new-task sheet): featured models, with the rest under "More models". */
export function ModelMenu({
  state,
  onSelect,
  modelRouter = false,
  onModelRouter,
}: {
  state: SessionState;
  onSelect: (model: ModelInfo) => void;
  /** Whether Model Router chooses the model and effort; the menu offers it only with `onModelRouter`. */
  modelRouter?: boolean;
  onModelRouter?: (on: boolean) => void;
}) {
  const { featured, more } = modelMenu(state.models);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {modelTriggerLabel(state.model, modelRouter && !!onModelRouter)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        {onModelRouter && (
          <ModelRouterItem
            modelRouter={modelRouter}
            onModelRouter={onModelRouter}
          />
        )}
        <ModelGroups
          groups={featured}
          current={modelRouter ? undefined : state.model}
          onSelect={onSelect}
        />
        {more.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More models</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                <ModelGroups
                  groups={more}
                  current={modelRouter ? undefined : state.model}
                  onSelect={onSelect}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
