import { useCallback, useState } from "react";
import type {
  ModelInfo,
  OpenedSession,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { ImageContent, UserMessage } from "../../shared/agentTypes";
import type { QueueKind } from "../../shared/queue";
import type { HostClient } from "@/lib/piHost";
import type { useStartingMessage } from "@/hooks/useStartingMessage";

/** Model and effort picked before a folder's first message, applied once its session starts. */
export type Pending = { model?: ModelInfo; level?: ThinkingLevel };

/** A model or effort choice as its request sends it. */
export type Choice =
  | { type: "set_model"; provider: string; modelId: string }
  | { type: "set_thinking_level"; level: ThinkingLevel }
  | { type: "route_next" };

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

const userMessage = (text: string, images: ImageContent[]): UserMessage => ({
  role: "user",
  content: images.length ? [{ type: "text", text }, ...images] : text,
  timestamp: Date.now(),
});

/** A message as `prompt` sends it to conversation `session`. */
export const promptRequest = (
  text: string,
  images: ImageContent[],
  session: string | null,
  queue?: QueueKind,
) => ({
  type: "prompt" as const,
  text,
  ...(images.length > 0 && { images }),
  ...(session && { session }),
  ...(queue && { queue }),
});

/**
 * A folder's first message: shown at once, it starts the conversation, which
 * takes the choices made before it (`pending`), then gets the message; Stop
 * meanwhile takes it back unsent.
 */
export function useComposerBegin({
  opened,
  folder,
  start,
  onBegin,
  starting,
  setState,
}: {
  opened: HostClient | null;
  folder: string | null;
  /** Shows the new conversation (its events apply from here on). */
  start: (s: OpenedSession) => void;
  /** The first message started conversation `session`. */
  onBegin?: (session: string, workdir: string) => void;
  starting: ReturnType<typeof useStartingMessage>;
  setState: (s: SessionState) => void;
}) {
  const [pending, setPending] = useState<Pending>({});

  const opening = useCallback(
    async (host: HostClient, cwd: string, session?: string) => {
      const s = await host.request({ type: "new_session", cwd, session });
      start(s);
      starting.started(s.session);
      onBegin?.(s.session, s.workdir);
      for (const choice of toChoices(pending)) {
        setState(await host.request({ ...choice, session: s.session }));
      }
      setPending({});
      return s.session;
    },
    [starting, start, onBegin, pending, setState],
  );

  const begin = useCallback(
    async (text: string, images: ImageContent[]) => {
      if (!opened || !folder) return;
      const typed = { text, ...(images.length && { images }) };
      // Missing over remote access's plain http: the sidecar picks one then.
      const id = crypto.randomUUID?.();
      starting.show(folder, userMessage(text, images), typed, id);
      try {
        const to = await opening(opened, folder, id);
        if (!starting.taken()) {
          await opened.request(promptRequest(text, images, to));
          starting.handed();
        }
      } catch (e) {
        starting.drop();
        throw e;
      }
    },
    [opened, folder, starting, opening],
  );

  return { pending, setPending, begin };
}
