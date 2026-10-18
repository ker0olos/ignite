import type { ImageContent } from "../../../shared/agentTypes";
import type { Approval, ModelRouter } from "@/components/agent/Composer";
import { ComposerAddMenu } from "@/components/agent/ComposerAddMenu";
import { ComposerToolbar } from "@/components/agent/ComposerToolbar";
import { GitStatusLinks } from "@/components/agent/GitStatusLinks";
import { QuestionActions } from "@/components/agent/QuestionActions";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useGitStatus } from "@/hooks/useGitStatus";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";
import type { HostClient } from "@/lib/piHost";

/** The composer's row under the text: attach and fork, the menus, and send/stop or a question's buttons. */
export function ComposerBar({
  host,
  session,
  running,
  canSend,
  asking,
  approval,
  modelRouter,
  gitStatus,
  onAttach,
  onStop,
}: {
  host: HostClient | null;
  session: ReturnType<typeof useAgentSession>;
  running: boolean;
  canSend: boolean;
  asking: QuestionDeck | null;
  approval: Approval;
  modelRouter: ModelRouter;
  gitStatus: boolean;
  onAttach: (images: ImageContent[]) => void;
  onStop: () => void;
}) {
  const repos = useGitStatus(host, gitStatus ? session.session : null);
  return (
    <div className="flex h-6 items-center gap-3.5 px-0.5 whitespace-nowrap max-sm:h-10">
      <ComposerAddMenu
        onAttach={onAttach}
        canFork={!session.none && !running}
        onFork={() => void session.fork()}
      />
      <ComposerToolbar
        session={session}
        running={running}
        canSend={canSend}
        approval={approval}
        modelRouter={modelRouter}
        git={
          <GitStatusLinks host={host} repos={repos} session={session.session} />
        }
        question={
          asking && (
            <QuestionActions
              last={asking.last}
              onBack={asking.back}
              onNext={asking.next}
              onSkip={asking.skip}
              onStop={onStop}
            />
          )
        }
        onStop={onStop}
      />
    </div>
  );
}
