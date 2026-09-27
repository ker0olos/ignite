import { ArrowRight, ChevronRight, KeyRound } from "lucide-react";
import type { Option } from "@/components/providers/ConnectProviders";

/** One sign-in or API-key choice on a provider card. */
export function OptionRow({
  option,
  disabled,
  onClick,
}: {
  option: Option;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = option.method === "api_key" ? KeyRound : ArrowRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{option.label}</span>
        <span className="block text-xs text-muted-foreground">
          {option.hint}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
