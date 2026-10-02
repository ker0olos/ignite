import { useEffect, useRef, useState } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import type { QueuedMessage } from "../../../shared/queue";
import type { ApprovalMode } from "../../../shared/hostProtocol";
import { AttachImagesButton } from "@/components/agent/AttachImagesButton";
import { ComposerInput } from "@/components/agent/ComposerInput";
import { ComposerToolbar } from "@/components/agent/ComposerToolbar";
import { GitStatusLinks } from "@/components/agent/GitStatusLinks";
import { ImageAttachments } from "@/components/agent/ImageAttachments";
import { MentionMenu } from "@/components/agent/MentionMenu";
import { QueuedMessages } from "@/components/agent/QueuedMessages";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useGitStatus } from "@/hooks/useGitStatus";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { useMentions } from "@/hooks/useMentions";
import { skillPrompt } from "@/lib/mentions";
import type { HostClient } from "@/lib/piHost";
import { composerKey, takenText } from "@/lib/queue";

type Session = ReturnType<typeof useAgentSession>;

/** The approval mode setting and how to change it. */
export type Approval = {
  mode: ApprovalMode;
  onChange: (mode: ApprovalMode) => void;
};

/** Task composer: prompt textarea, toolbar, and send/stop button. */
export function Composer({
  host,
  folder,
  session,
  loading,
  running,
  approval,
  gitStatus,
}: {
  host: HostClient | null;
  folder: string;
  session: Session;
  loading: boolean;
  running: boolean;
  approval: Approval;
  gitStatus: boolean;
}) {
  const { state } = session;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageContent[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
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
  const canSend =
    (!!state || session.none) && (!!text.trim() || images.length > 0);
  // While the agent works, a message waits for the run's end.
  const handleSend = () => {
    if (!canSend) return;
    setText("");
    setImages([]);
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
  const attach = (added: ImageContent[]) =>
    setImages((current) => [...current, ...added]);
  useProvideImageTarget("Add to conversation", (image) => {
    attach([image]);
    input.current?.focus();
  });

  return (
    <form
      className="relative mx-auto w-full max-w-3xl px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
    >
      <MentionMenu {...mentions.menu} />
      <div className="group border-t transition-colors focus-within:border-foreground/35">
        <QueuedMessages
          queued={queued}
          unqueue={session.unqueue}
          onEdit={(m) => restore([m])}
        />
        <ImageAttachments
          images={images}
          onRemove={(i) =>
            setImages((current) => current.filter((_, j) => j !== i))
          }
          onEdit={(i, marked) =>
            setImages((current) =>
              current.map((x, j) => (j === i ? marked : x)),
            )
          }
        />
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
              { running, empty: !canSend, queued: queued.length > 0 },
            );
            if (!act) return;
            e.preventDefault();
            if (act === "stop") stop();
            else if (act === "now") void session.unqueue(queued[0], "now");
            else handleSend();
          }}
        />
        <div className="flex h-6 items-center gap-3.5 px-0.5 max-sm:h-10">
          <AttachImagesButton onAttach={attach} />
          <ComposerToolbar
            session={session}
            loading={loading}
            running={running}
            canSend={canSend}
            approval={approval}
            git={<GitStatusLinks host={host} repos={repos} />}
            onStop={stop}
          />
        </div>
      </div>
    </form>
  );
}
