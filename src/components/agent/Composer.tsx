import { type KeyboardEvent, useRef } from "react";
import type { ApprovalMode } from "../../../shared/hostProtocol";
import { ComposerBar } from "@/components/agent/ComposerBar";
import { ComposerInput } from "@/components/agent/ComposerInput";
import { ComposerQuestion } from "@/components/agent/ComposerQuestion";
import { ComposerAttachments } from "@/components/agent/ComposerAttachments";
import { MentionMenu } from "@/components/agent/MentionMenu";
import { QueuedMessages } from "@/components/agent/QueuedMessages";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useComposerDraft } from "@/hooks/useComposerDraft";
import { useComposerFocus } from "@/hooks/useComposerFocus";
import { useComposerHistory } from "@/hooks/useComposerHistory";
import { useComposerQuestionKeys } from "@/hooks/useComposerQuestionKeys";
import { useComposerSend } from "@/hooks/useComposerSend";
import { useMentions } from "@/hooks/useMentions";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";
import { shortcut } from "@/lib/approvalKeys";
import type { HostClient } from "@/lib/piHost";
import { noteLabel } from "@/lib/questions";
import { composerKey } from "@/lib/queue";
import { imageName } from "@/lib/images";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";

type Session = ReturnType<typeof useAgentSession>;

const FIELDSET =
  "group min-w-0 border-t transition-colors focus-within:border-foreground/35 disabled:opacity-50";
// A question makes it a card, like the tool rows' prompts.
const QUESTION_CARD = "rounded-lg border bg-card px-3 pb-2";

/** The approval mode setting and how to change it. */
export type Approval = {
  mode: ApprovalMode;
  onChange: (mode: ApprovalMode) => void;
};

/** The Model Router setting: a quick model picks a new conversation's model and effort. */
export type ModelRouter = { on: boolean; onChange: (on: boolean) => void };

/** Task composer: prompt textarea, toolbar, and send/stop button; while the agent asks, its questions' answer. */
export function Composer({
  host,
  folder,
  session,
  running,
  asking,
  approval,
  modelRouter,
  gitStatus,
}: {
  host: HostClient | null;
  folder: string;
  session: Session;
  running: boolean;
  /** The agent's questions, which the composer answers while they wait. */
  asking: QuestionDeck | null;
  approval: Approval;
  modelRouter: ModelRouter;
  gitStatus: boolean;
}) {
  const skills = session.state?.skills ?? [];
  const input = useRef<HTMLTextAreaElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const draft = useComposerDraft(asking, input);
  const { text, setText, images, attach, remove, replace, paste } = draft;
  const mentions = useMentions({
    host,
    folder,
    text,
    setText,
    input,
    skills,
    images: images.length,
    imageNames: images.map((i) => imageName(i) ?? "Clipboard"),
    attached: draft.files.map((f) => basename(f.path)),
  });
  const history = useComposerHistory(text, setText, input);
  const questionKeys = useComposerQuestionKeys(asking, options, input);
  useComposerFocus(input);
  const message = useComposerSend({
    session,
    skills,
    draft,
    record: history.record,
    input,
  });
  const { sendable, stop } = message;
  const queued = session.transcript?.queued ?? [];
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.onKeyDown(e) || questionKeys.onInputKey(e)) return;
    if (!asking && history.onKeyDown(e)) return;
    const act = composerKey(
      { ...e, isComposing: e.nativeEvent.isComposing },
      { running, empty: !sendable, queued: queued.length > 0 },
    );
    // A question leaves the composer only Esc's stop.
    if (!act || (asking && act !== "stop")) return;
    e.preventDefault();
    if (act === "stop") stop();
    else if (act === "now") void session.unqueue(queued[0], "now");
    else message.send();
  };

  return (
    <form
      className="relative mx-auto w-full max-w-3xl px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (asking) asking.next();
        else message.send();
      }}
    >
      <MentionMenu {...mentions.menu} />
      {/* While a fork is open, every control here is off (a disabled fieldset). */}
      <fieldset
        disabled={session.waitingOnFork}
        className={cn(FIELDSET, asking && QUESTION_CARD)}
      >
        <QueuedMessages
          queued={queued}
          unqueue={session.unqueue}
          onEdit={(m) => message.restore([m])}
        />
        {asking && (
          <ComposerQuestion
            key={`${asking.id} ${asking.step}`}
            deck={asking}
            ref={options}
            onKeyDown={questionKeys.onOptionKey}
          />
        )}
        <ComposerAttachments
          images={images}
          onRemoveImage={remove}
          onEditImage={replace}
          attached={message}
        />
        <ComposerInput
          ref={input}
          value={text}
          onChange={setText}
          onCaret={mentions.setCaret}
          onImages={paste}
          onKeyDown={onKeyDown}
          {...askingInput(asking)}
        />
        <ComposerBar
          host={host}
          session={session}
          running={running}
          canSend={sendable}
          asking={asking}
          approval={approval}
          modelRouter={modelRouter}
          gitStatus={gitStatus}
          onAttach={attach}
          onStop={stop}
        />
      </fieldset>
    </form>
  );
}

/** The composer's text box while a question shows: a note on the picks, or the user's own answer. */
function askingInput(asking: QuestionDeck | null) {
  if (!asking) return {};
  if (noteLabel(asking.draft.picked)) {
    return { placeholder: "Add a note for the agent (optional)", tight: true };
  }
  return { placeholder: `Or write your own answer (${shortcut("N")})` };
}
