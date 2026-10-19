import { useCallback, useRef, useState } from "react";
import type { UserMessage } from "../../shared/agentTypes";
import type { QueuedMessage } from "../../shared/queue";
import { addedFirst, type Starting } from "@/lib/routedMessage";
import type { Transcript } from "@/lib/transcript";

/** A folder's first message, shown as it's sent while its conversation starts, until pi adds its own copy. */
export function useStartingMessage(
  shown: string | null,
  transcript: Transcript | null,
) {
  const [starting, setStarting] = useState<Starting | null>(null);
  // As typed, so Stop can hand it back; null once taken.
  const sent = useRef<QueuedMessage | null>(null);
  // Adjusted while rendering, as React suggests for state that follows props.
  if (starting?.session && starting.session === shown && addedFirst(transcript))
    setStarting(null);

  return {
    starting,
    /** Shows `message` in `folder` at once, its first (`typed` as the composer had it). */
    show: useCallback(
      (folder: string, message: UserMessage, typed: QueuedMessage) => {
        sent.current = typed;
        setStarting({ folder, message });
      },
      [],
    ),
    /** Its conversation turned out to be `session`. */
    started: useCallback(
      (session: string) => setStarting((s) => s && { ...s, session }),
      [],
    ),
    /** It wasn't sent. */
    drop: useCallback(() => setStarting(null), []),
    /** Stop while it starts: takes it back, unsent. */
    take: useCallback((): QueuedMessage[] => {
      const typed = sent.current;
      sent.current = null;
      setStarting(null);
      return typed ? [typed] : [];
    }, []),
    /** Whether Stop took it back. */
    taken: useCallback(() => sent.current === null, []),
  };
}
