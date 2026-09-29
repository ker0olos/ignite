import { CircleAlert, LoaderCircle } from "lucide-react";
import type { AgentStatus } from "../../../shared/hostProtocol";

/** A conversation waiting on the user, working, or idle. */
export function AgentStatusIcon({ status }: { status: AgentStatus }) {
  const label = status.waiting
    ? "Needs approval"
    : status.running
      ? "Working"
      : "Idle";
  return (
    <span
      title={label}
      aria-label={label}
      className="flex size-4 shrink-0 items-center justify-center"
    >
      {status.waiting ? (
        <CircleAlert className="size-3.5 text-warning" />
      ) : status.running ? (
        <LoaderCircle className="size-3.5 animate-spin text-warning" />
      ) : (
        <span className="size-2 rounded-full bg-success" />
      )}
    </span>
  );
}
