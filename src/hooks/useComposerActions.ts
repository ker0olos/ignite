import { useCallback } from "react";
import type {
  ModelInfo,
  OpenedSession,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { QueueKind, QueuedMessage, Unqueue } from "../../shared/queue";
import type { HostClient } from "@/lib/piHost";
import { useCompact } from "@/hooks/useCompact";
import { useFork } from "@/hooks/useFork";
import {
  promptRequest,
  useComposerBegin,
  type Choice,
  type Pending,
} from "@/hooks/useComposerBegin";
import type { useStartingMessage } from "@/hooks/useStartingMessage";
import { appCommand } from "@/lib/mentions";
import type { Queued } from "@/lib/queue";

/**
 * Sending, stopping, and the model and effort choices, each for `session`
 * (the shown conversation) by name. In a folder with no conversation (`none`),
 * choices wait and the first message starts one: the session opens, takes
 * the choices, then gets the message, all by the new one's name.
 */
export function useComposerActions({
  opened,
  folder,
  session,
  none,
  start,
  onBegin,
  starting,
  setState,
  setError,
}: {
  opened: HostClient | null;
  folder: string | null;
  session: string | null;
  none: boolean;
  /** Shows the new conversation (its events apply from here on). */
  start: (s: OpenedSession) => void;
  /** The first message started conversation `session`. */
  onBegin?: (session: string, workdir: string) => void;
  /** The first message, shown while its conversation starts. */
  starting: ReturnType<typeof useStartingMessage>;
  setState: (s: SessionState) => void;
  setError: (e: string | null) => void;
}) {
  const { pending, setPending, begin } = useComposerBegin({
    opened,
    folder,
    start,
    onBegin,
    starting,
    setState,
  });

  const compact = useCompact(opened, none, session, setError);
  const fork = useFork(opened, folder, none ? null : session, start, setError);

  const send = useCallback(
    async (text: string, images: ImageContent[] = [], queue?: QueueKind) => {
      if (!opened || (!text.trim() && !images.length)) return;
      const instructions = appCommand("compact", text);
      if (instructions !== null) return compact(instructions);
      const task = appCommand("fork", text);
      if (task !== null) return fork(task, images);
      setError(null);
      try {
        await (none
          ? begin(text, images)
          : opened.request(promptRequest(text, images, session, queue)));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, none, session, begin, setError, compact, fork],
  );

  const change = useCallback(
    async (choice: Choice, held: Pending) => {
      if (none) return setPending((p) => ({ ...p, ...held }));
      if (!opened) return;
      setError(null);
      try {
        setState(
          await opened.request({ ...choice, ...(session && { session }) }),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, none, session, setPending, setState, setError],
  );

  /** Stops the run; resolves to the queued messages it took back. */
  const stop = useCallback(async (): Promise<QueuedMessage[]> => {
    // Still starting: the message comes back unsent.
    if (none) return starting.take();
    const taken = await opened
      ?.request({ type: "abort", ...(session && { session }) })
      .catch(() => []);
    return taken ?? [];
  }, [opened, none, session, starting]);

  /** Takes a queued message back, moves it up or sends it now (see Unqueue). */
  const unqueue = useCallback(
    async ({ kind, text }: Queued, action?: Unqueue["action"]) => {
      if (!opened) return null;
      setError(null);
      try {
        return await opened.request({
          type: "unqueue",
          kind,
          text,
          ...(action && { action }),
          ...(session && { session }),
        });
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [opened, session, setError],
  );

  return {
    pending,
    send,
    compact,
    fork,
    stop,
    unqueue,
    setModel: (model: ModelInfo) =>
      change(
        { type: "set_model", provider: model.provider, modelId: model.id },
        { model },
      ),
    setThinkingLevel: (level: ThinkingLevel) =>
      change({ type: "set_thinking_level", level }, { level }),
    /** Drops the model picked for the conversation about to start, so Model Router picks it. */
    unpickModel: () => setPending(({ level }) => ({ ...(level && { level }) })),
  };
}
