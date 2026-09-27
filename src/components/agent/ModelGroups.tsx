import { Check } from "lucide-react";
import type { ModelInfo } from "../../../shared/hostProtocol";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { same, type MenuGroup } from "@/lib/modelMenu";

/** One or more model groups, each with a label when there is more than one. */
export function ModelGroups({
  groups,
  current,
  onSelect,
}: {
  groups: MenuGroup[];
  current?: ModelInfo;
  onSelect: (model: ModelInfo) => void;
}) {
  return (
    <>
      {groups.map((group, i) => (
        <DropdownMenuGroup key={group.name} className={i > 0 ? "mt-2" : ""}>
          {groups.length > 1 && (
            <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
          )}
          {group.models.map((model) => (
            <DropdownMenuItem
              key={`${model.provider}/${model.id}`}
              onClick={() => onSelect(model)}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px]">{model.label}</span>
                {model.description && (
                  <span className="truncate text-xs text-muted-foreground">
                    {model.description}
                  </span>
                )}
              </div>
              {current && same(current, model) && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      ))}
    </>
  );
}
