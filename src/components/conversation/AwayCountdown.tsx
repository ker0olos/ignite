import { useNow } from "@/hooks/useNow";
import { awayCountdown } from "@/lib/awayCountdown";

/** How long until a waiting call is denied as the user being away, once they've been idle a while. */
export function AwayCountdown({ awayAt }: { awayAt?: number }) {
  const text = awayCountdown(awayAt, useNow(1000));
  if (!text) return null;
  return (
    <span className="self-center text-xs text-muted-foreground tabular-nums">
      {text}
    </span>
  );
}
