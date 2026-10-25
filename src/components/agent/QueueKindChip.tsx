import type { QueueKind } from "../../../shared/queue";
import { cn } from "@/lib/utils";

const LABEL: Record<QueueKind, { text: string; title: string }> = {
  steer: {
    text: "Steer",
    title:
      "The agent reads this after its current step. Click to wait until it's done.",
  },
  followUp: {
    text: "Next",
    title:
      "Waits until the agent is done. Click to have it read this after its current step.",
  },
};

/** A queued message's kind, Steer or Next; clicking switches it. */
export function QueueKindChip({
  kind,
  onSwitch,
}: {
  kind: QueueKind;
  onSwitch: () => void;
}) {
  const { text, title } = LABEL[kind];
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "shrink-0 rounded-full border px-1.5 text-xs leading-4 outline-none focus-visible:ring-1 focus-visible:ring-ring",
        kind === "steer"
          ? "border-primary/40 text-primary"
          : "border-border text-muted-foreground/70 hover:text-foreground",
      )}
      onClick={onSwitch}
    >
      {text}
    </button>
  );
}
