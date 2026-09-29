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

/** The composer's right-hand controls: model/effort menus, status, and send/stop. */
export function ComposerToolbar({
  session,
  loading,
  running,
  canSend,
  approval,
}: {
  session: Session;
  loading: boolean;
  running: boolean;
  canSend: boolean;
  approval: Approval;
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
      {session.error && (
        <span className="truncate text-xs text-destructive">
          {session.error}
        </span>
      )}
      {running ? (
        <button
          type="button"
          className={ACTION}
          onClick={() => void session.stop()}
        >
          Stop <Kbd>esc</Kbd>
        </button>
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
