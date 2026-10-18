import type { ReactNode } from "react";
import { ApprovalMenu } from "@/components/agent/ApprovalMenu";
import type { Approval, ModelRouter } from "@/components/agent/Composer";
import { ComposerModelMenus } from "@/components/agent/ComposerModelMenus";
import { Kbd } from "@/components/agent/Kbd";
import { ACTION, QUIET_ACTION } from "@/components/agent/styles";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { cn } from "@/lib/utils";

type Session = ReturnType<typeof useAgentSession>;

/** The composer's right-hand controls: model/effort menus, status, and send/stop (or a question's buttons). */
export function ComposerToolbar({
  session,
  running,
  canSend,
  approval,
  modelRouter,
  git,
  question,
  onStop,
}: {
  session: Session;
  running: boolean;
  canSend: boolean;
  approval: Approval;
  modelRouter: ModelRouter;
  /** The conversation's repositories, after the approval menu. */
  git: ReactNode;
  /** A question's buttons, in place of send, queue and stop. */
  question?: ReactNode;
  onStop: () => void;
}) {
  return (
    <>
      {/* Until the menus can draw: a new conversation's models arrive after it shows. */}
      {!session.state && !session.error && (
        <>
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-8" />
        </>
      )}
      <ComposerModelMenus session={session} modelRouter={modelRouter} />
      <ApprovalMenu mode={approval.mode} onChange={approval.onChange} />
      {git}
      {question ??
        (running ? (
          <div className={ACTION}>
            {canSend && (
              <button type="submit" className={QUIET_ACTION}>
                Queue <Kbd>↵</Kbd>
              </button>
            )}
            <button type="button" className={QUIET_ACTION} onClick={onStop}>
              Stop <Kbd>esc</Kbd>
            </button>
          </div>
        ) : (
          <button
            type="submit"
            className={cn(ACTION, !canSend && "invisible")}
            disabled={!canSend}
          >
            Send <Kbd>↵</Kbd>
          </button>
        ))}
    </>
  );
}
