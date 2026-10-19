import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { withFiles, type SentFile } from "../../shared/attachedFiles";
import type { QueuedMessage } from "../../shared/queue";
import { readMessage } from "../../shared/sentComments";
import type { SkillInfo } from "../../shared/skills";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useComposerComments } from "@/hooks/useComposerComments";
import { appCommand, skillPrompt } from "@/lib/mentions";
import { canSend, takenText } from "@/lib/queue";

type Session = ReturnType<typeof useAgentSession>;

/** The composer's message as it's sent: its text, images, files and diff comments; stopping, which hands queued ones back. */
export function useComposerSend({
  session,
  skills,
  draft,
  record,
  input,
}: {
  session: Session;
  skills: SkillInfo[];
  draft: {
    text: string;
    setText: Dispatch<SetStateAction<string>>;
    images: ImageContent[];
    setImages: Dispatch<SetStateAction<ImageContent[]>>;
    files: SentFile[];
    setFiles: Dispatch<SetStateAction<SentFile[]>>;
  };
  /** Keeps a sent message in the composer's history. */
  record: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
}) {
  const { text, setText, images, setImages, setFiles } = draft;
  const comments = useComposerComments(session.session);
  // While a question shows, they're its answer's (see AgentPanel).
  const shown = comments.comments;
  const files = draft.files;
  const sendable = canSend(
    session.ready || session.none,
    { text, images: images.length + shown.length + files.length },
    (session.transcript?.routing ?? false) || session.starting,
    session.waitingOnFork,
  );
  // While the agent works, a message waits for the run's end.
  const send = () => {
    if (!sendable) return;
    record(text);
    setText("");
    // `/compact` sends no images, files or comments; they wait for the next message.
    const compact = appCommand("compact", text) !== null;
    if (!compact) {
      setImages([]);
      setFiles([]);
    }
    const message = skillPrompt(text, skills);
    void session.send(
      compact ? message : comments.take(withFiles(message, files)),
      images,
      "followUp",
    );
  };
  const restore = (taken: QueuedMessage[]) => {
    setText((t) => takenText(taken, t));
    comments.restore(taken.map((m) => m.text));
    setFiles((f) => [...taken.flatMap((m) => readMessage(m.text).files), ...f]);
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
    files,
    removeFile: (i: number) => setFiles((f) => f.filter((_, j) => j !== i)),
  };
}
