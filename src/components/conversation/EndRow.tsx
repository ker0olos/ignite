import type { Row } from "@/lib/toolRows";

/** Conversation stop or error row. */
export function EndRow({
  message,
}: {
  message: Extract<Row, { kind: "end" }>["message"];
}) {
  if (message.stopReason === "error") {
    return (
      <p className="text-[13px] text-destructive">{message.errorMessage}</p>
    );
  }
  return <p className="text-xs text-muted-foreground">Stopped</p>;
}
