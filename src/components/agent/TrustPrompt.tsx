import { ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Asks once whether to trust a folder that has its own pi resources (`.pi/`
 * extensions, skills, settings), which run code when they load.
 */
export function TrustPrompt({
  onAnswer,
}: {
  onAnswer: (trusted: boolean) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="flex items-start gap-2 rounded-lg border p-2.5 text-[13px]">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Trust this folder?</p>
          <p className="text-xs text-muted-foreground">
            It has its own pi extensions, skills or settings (.pi/). Extensions
            run code, so only trust folders you know.
          </p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" onClick={() => onAnswer(true)}>
              Trust
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAnswer(false)}>
              Don't trust
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
