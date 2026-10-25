import { useNow } from "@/hooks/useNow";
import { QUIET_MS, type QuietRequest } from "@/lib/quietRequest";

/** Under the working line, once the model has left a request unanswered for a while: why it may be slow. */
export function QuietRequestNote({ since, reason }: QuietRequest) {
  const now = useNow(1000);
  if (now - since < QUIET_MS) return null;
  return <p className="pl-3.5 text-xs text-muted-foreground/70">{reason}</p>;
}
