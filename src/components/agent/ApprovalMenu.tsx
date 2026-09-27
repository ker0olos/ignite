import type { ApprovalMode } from "../../../shared/hostProtocol";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { APPROVAL_MODES } from "@/lib/approvalPolicy";

/** Composer's approval toggle: Auto or Manual tool approval. */
export function ApprovalMenu({
  mode,
  onChange,
}: {
  mode: ApprovalMode;
  onChange: (mode: ApprovalMode) => void;
}) {
  const current = APPROVAL_MODES.find((m) => m.mode === mode);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {current?.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => onChange(value as ApprovalMode)}
        >
          {APPROVAL_MODES.map((m) => (
            <DropdownMenuRadioItem key={m.mode} value={m.mode}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px]">{m.label}</span>
                <span className="text-xs text-muted-foreground">
                  {m.description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
