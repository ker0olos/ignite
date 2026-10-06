import { useContext } from "react";
import { Button } from "@/components/ui/button";
import { ContinueContext } from "@/components/conversation/shared";
import type { Row } from "@/lib/toolRows";

// Longer errors are diagnostics (a stack, a provider's essay): kept under Details.
const SHORT_ERROR = 160;

/** Conversation stop or error row; the last error offers Continue. */
export function EndRow({
  message,
  last,
}: {
  message: Extract<Row, { kind: "end" }>["message"];
  last: boolean;
}) {
  const onContinue = useContext(ContinueContext);
  if (message.stopReason !== "error") {
    return <p className="text-xs text-muted-foreground">Stopped</p>;
  }
  const error = message.errorMessage ?? "";
  const short = error.length <= SHORT_ERROR;
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-destructive">
        {short && error ? error : "The run stopped on an error."}
      </p>
      {!short && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Details
          </summary>
          <p className="mt-1 [overflow-wrap:anywhere]">{error}</p>
        </details>
      )}
      {last && onContinue && (
        <Button size="sm" variant="outline" onClick={onContinue}>
          Continue
        </Button>
      )}
    </div>
  );
}
