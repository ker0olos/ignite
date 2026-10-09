import { useEffect, useRef, useState } from "react";
import type { QueuedMessage } from "../../../shared/queue";
import type { ApprovalMode } from "../../../shared/hostProtocol";
import { ComposerAddMenu } from "@/components/agent/ComposerAddMenu";
import { ComposerInput } from "@/components/agent/ComposerInput";
import { ComposerToolbar } from "@/components/agent/ComposerToolbar";
import { GitStatusLinks } from "@/components/agent/GitStatusLinks";
import { ImageAttachments } from "@/components/agent/ImageAttachments";
import { MentionMenu } from "@/components/agent/MentionMenu";
import { QueuedMessages } from "@/components/agent/QueuedMessages";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useGitStatus } from "@/hooks/useGitStatus";
import { useComposerImages } from "@/hooks/useComposerImages";
import { useMentions } from "@/hooks/useMentions";
import { appCommand, skillPrompt } from "@/lib/mentions";
import type { HostClient } from "@/lib/piHost";
import { canSend, composerKey, takenText } from "@/lib/queue";

type Session = ReturnType<typeof useAgentSession>;

/** The approval mode setting and how to change it. */
export type Approval = {
  mode: ApprovalMode;
  onChange: (mode: ApprovalMode) => void;
};

/** The Model Router setting: a quick model picks a new conversation's model and effort. */
export type ModelRouter = { on: boolean; onChange: (on: boolean) => void };

/** Task composer: prompt textarea, toolbar, and send/stop button. */
export function Composer({
  host,
  folder,
  session,
  loading,
  running,
  approval,
  modelRouter,
  gitStatus,
}: {
  host: HostClient | null;
  folder: string;
  session: Session;
  loading: boolean;
  running: boolean;
  approval: Approval;
  modelRouter: ModelRouter;
  gitStatus: boolean;
}) {
  const { state } = session;
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const { images, setImages, attach, remove, replace } =
    useComposerImages(input);
  const repos = useGitStatus(host, gitStatus ? session.session : null);
  const mentions = useMentions({
    host,
    folder,
    text,
    setText,
    input,
    skills: state?.skills ?? [],
    images: images.length,
  });

  // A new conversation is ready to type in.
  useEffect(() => {
    if (session.fresh) input.current?.focus();
  }, [session.fresh]);

  const queued = session.transcript?.queued ?? [];
  const sendable = canSend(
    !!state || session.none,
    { text, images: images.length },
    session.transcript?.routing ?? false,
    session.waitingOnFork,
  );
  // While the agent works, a message waits for the run's end.
  const handleSend = () => {
    if (!sendable) return;
    setText("");
    // `/compact` sends no images; they wait for the next message.
    if (appCommand("compact", text) === null) setImages([]);
    void session.send(
      skillPrompt(text, state?.skills ?? []),
      images,
      "followUp",
    );
  };
  const restore = (taken: QueuedMessage[]) => {
    setText((t) => takenText(taken, t));
    setImages((i) => [...taken.flatMap((m) => m.images ?? []), ...i]);
    input.current?.focus();
  };
  const stop = () => void session.stop().then(restore);

  return (
    <form
      className="relative mx-auto w-full max-w-3xl px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
    >
      <MentionMenu {...mentions.menu} />
      {/* While a fork is open, every control here is off (a disabled fieldset). */}
      <fieldset
        disabled={session.waitingOnFork}
        className="group min-w-0 border-t transition-colors focus-within:border-foreground/35 disabled:opacity-50"
      >
        <QueuedMessages
          queued={queued}
          unqueue={session.unqueue}
          onEdit={(m) => restore([m])}
        />
        <ImageAttachments images={images} onRemove={remove} onEdit={replace} />
        <ComposerInput
          ref={input}
          value={text}
          onChange={setText}
          onCaret={mentions.setCaret}
          onImages={attach}
          onKeyDown={(e) => {
            if (mentions.onKeyDown(e)) return;
            const act = composerKey(
              { ...e, isComposing: e.nativeEvent.isComposing },
              { running, empty: !sendable, queued: queued.length > 0 },
            );
            if (!act) return;
            e.preventDefault();
            if (act === "stop") stop();
            else if (act === "now") void session.unqueue(queued[0], "now");
            else handleSend();
          }}
        />
        <div className="flex h-6 items-center gap-3.5 px-0.5 max-sm:h-10">
          <ComposerAddMenu
            onAttach={attach}
            canFork={!session.none && !running}
            onFork={() => void session.fork()}
          />
          <ComposerToolbar
            session={session}
            loading={loading}
            running={running}
            canSend={sendable}
            approval={approval}
            modelRouter={modelRouter}
            git={<GitStatusLinks host={host} repos={repos} />}
            onStop={stop}
          />
        </div>
      </fieldset>
    </form>
  );
}
