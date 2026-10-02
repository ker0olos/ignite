import type { ReactNode } from "react";
import { ApprovalMenu } from "@/components/agent/ApprovalMenu";
import type { Approval } from "@/components/agent/Composer";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { Kbd } from "@/components/agent/Kbd";
import { ModelMenu } from "@/components/agent/ModelMenu";
import { ACTION } from "@/components/agent/styles";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { cn } from "@/lib/utils";

type Session = ReturnType<typeof useAgentSession>;

const QUEUE =
  "flex items-center gap-2 outline-none hover:opacity-80 focus-visible:underline";

/** The composer's right-hand controls: model/effort menus, status, and send/stop. */
export function ComposerToolbar({
  session,
  loading,
  running,
  canSend,
  approval,
  git,
  onStop,
}: {
  session: Session;
  loading: boolean;
  running: boolean;
  canSend: boolean;
  approval: Approval;
  /** The conversation's repositories, after the approval menu. */
  git: ReactNode;
  onStop: () => void;
}) {
  const { state } = session;
  return (
    <>
      {loading && (
        <>
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-8" />
        </>
      )}
      {state && state.models.length > 0 && (
        <ModelMenu state={state} onSelect={session.setModel} />
      )}
      {/* pi offers only "off" for models that can't reason. */}
      {state && state.thinkingLevels.length > 1 && (
        <EffortMenu
          state={state}
          onChange={(level) => void session.setThinkingLevel(level)}
        />
      )}
      <ApprovalMenu mode={approval.mode} onChange={approval.onChange} />
      {git}
      {session.error && (
        <span className="truncate text-xs text-destructive">
          {session.error}
        </span>
      )}
      {running ? (
        <div className={ACTION}>
          {canSend && (
            <button type="submit" className={QUEUE}>
              Queue <Kbd>↵</Kbd>
            </button>
          )}
          <button type="button" className={QUEUE} onClick={onStop}>
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
      )}
    </>
  );
}
