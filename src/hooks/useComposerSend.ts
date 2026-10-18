import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import type { QueuedMessage } from "../../shared/queue";
import type { SkillInfo } from "../../shared/skills";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useComposerComments } from "@/hooks/useComposerComments";
import { appCommand, skillPrompt } from "@/lib/mentions";
import { canSend, takenText } from "@/lib/queue";

type Session = ReturnType<typeof useAgentSession>;

/** The composer's message as it's sent: its text, images and diff comments; stopping, which hands queued ones back. */
export function useComposerSend({
  session,
  asking,
  skills,
  draft,
  record,
  input,
}: {
  session: Session;
  /** A question shows, which the composer answers instead. */
  asking: boolean;
  skills: SkillInfo[];
  draft: {
    text: string;
    setText: Dispatch<SetStateAction<string>>;
    images: ImageContent[];
    setImages: Dispatch<SetStateAction<ImageContent[]>>;
  };
  /** Keeps a sent message in the composer's history. */
  record: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
}) {
  const { text, setText, images, setImages } = draft;
  const comments = useComposerComments(session.session);
  // A question's answer leaves them for the next message.
  const shown = asking ? [] : comments.comments;
  const sendable = canSend(
    !!session.state || session.none,
    { text, images: images.length + shown.length },
    session.transcript?.routing ?? false,
    session.waitingOnFork,
  );
  // While the agent works, a message waits for the run's end.
  const send = () => {
    if (!sendable) return;
    record(text);
    setText("");
    // `/compact` sends no images or comments; they wait for the next message.
    const compact = appCommand("compact", text) !== null;
    if (!compact) setImages([]);
    const message = skillPrompt(text, skills);
    void session.send(
      compact ? message : comments.take(message),
      images,
      "followUp",
    );
  };
  const restore = (taken: QueuedMessage[]) => {
    setText((t) => takenText(taken, t));
    comments.restore(taken.map((m) => m.text));
    setImages((i) => [...taken.flatMap((m) => m.images ?? []), ...i]);
    input.current?.focus();
  };
  return {
    sendable,
    send,
    restore,
    stop: () => void session.stop().then(restore),
    comments: shown,
    removeComment: comments.remove,
  };
}
