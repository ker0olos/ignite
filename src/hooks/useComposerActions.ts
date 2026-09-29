import { useCallback, useState } from "react";
import type {
  ModelInfo,
  OpenedSession,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";

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
    async (text: string, images: ImageContent[] = []) => {
      if (!opened || (!text.trim() && !images.length)) return;
      setError(null);
      try {
        const to = none ? await begin() : session;
        await opened.request({
          type: "prompt",
          text,
          ...(images.length > 0 && { images }),
          ...(to && { session: to }),
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

  const stop = useCallback(async () => {
    await opened
      ?.request({ type: "abort", ...(session && { session }) })
      .catch(() => {});
  }, [opened, session]);

  return {
    pending,
    send,
    stop,
    setModel: (model: ModelInfo) =>
      change(
        { type: "set_model", provider: model.provider, modelId: model.id },
        { model },
      ),
    setThinkingLevel: (level: ThinkingLevel) =>
      change({ type: "set_thinking_level", level }, { level }),
  };
}
