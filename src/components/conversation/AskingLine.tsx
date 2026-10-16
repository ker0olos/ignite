import { CircleHelp } from "lucide-react";
import { useContext } from "react";
import { AskingStepContext } from "@/components/conversation/shared";

/** An ask_user call waiting for answers, which the composer takes: which question it's on. */
export function AskingLine({ count }: { count: number }) {
  const step = useContext(AskingStepContext);
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleHelp className="size-3.5" />
      Asking you{count > 1 && ` · ${step + 1} of ${count}`}
    </p>
  );
}
