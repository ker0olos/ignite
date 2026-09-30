import { useCallback, useState } from "react";
import type {
  ModelInfo,
  OpenedSession,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { QueueKind, QueuedMessage, Unqueue } from "../../shared/queue";
import type { HostClient } from "@/lib/piHost";
import type { Queued } from "@/lib/queue";

/** Model and effort picked before a folder's first message, applied once its session starts. */
export type Pending = { model?: ModelInfo; level?: ThinkingLevel };

type Choice =
  | { type: "set_model"; provider: string; modelId: string }
  | { type: "set_thinking_level"; level: ThinkingLevel };

const toChoices = ({ model, level }: Pending): Choice[] => [
  ...(model
    ? [
        {
          type: "set_model" as const,
          provider: model.provider,
          modelId: model.id,
        },
      ]
    : []),
  ...(level ? [{ type: "set_thinking_level" as const, level }] : []),
];

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
  setState,
  setError,
}: {
  opened: HostClient | null;
  folder: string | null;
  session: string | null;
  none: boolean;
  /** Shows the new conversation (its events apply from here on). */
  start: (s: OpenedSession) => void;
  setState: (s: SessionState) => void;
  setError: (e: string | null) => void;
}) {
  const [pending, setPending] = useState<Pending>({});

  const begin = useCallback(async () => {
    if (!opened || !folder) return null;
    const s = await opened.request({ type: "new_session", cwd: folder });
    start(s);
    for (const choice of toChoices(pending)) {
      setState(await opened.request({ ...choice, session: s.session }));
    }
    setPending({});
    return s.session;
  }, [opened, folder, start, pending, setState]);

  const send = useCallback(
    async (text: string, images: ImageContent[] = [], queue?: QueueKind) => {
      if (!opened || (!text.trim() && !images.length)) return;
      setError(null);
      try {
        const to = none ? await begin() : session;
        await opened.request({
          type: "prompt",
          text,
          ...(images.length > 0 && { images }),
          ...(to && { session: to }),
          ...(queue && { queue }),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, none, session, begin, setError],
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
    [opened, none, session, setState, setError],
  );

  /** Stops the run; resolves to the queued messages it took back. */
  const stop = useCallback(async (): Promise<QueuedMessage[]> => {
    const taken = await opened
      ?.request({ type: "abort", ...(session && { session }) })
      .catch(() => []);
    return taken ?? [];
  }, [opened, session]);

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
    stop,
    unqueue,
    setModel: (model: ModelInfo) =>
      change(
        { type: "set_model", provider: model.provider, modelId: model.id },
        { model },
      ),
    setThinkingLevel: (level: ThinkingLevel) =>
      change({ type: "set_thinking_level", level }, { level }),
  };
}
