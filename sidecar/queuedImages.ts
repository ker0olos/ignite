import type {
  AgentMessage,
  ImageContent,
  UserMessage,
} from "../shared/agentTypes.ts";
import type { Agent } from "./hostTypes.ts";

/** Remembers a queued message's images (an empty list for none). */
export function rememberImages(
  agent: Agent,
  text: string,
  images: ImageContent[] = [],
) {
  agent.queuedImages.set(text, [
    ...(agent.queuedImages.get(text) ?? []),
    images,
  ]);
}

/** Takes the oldest images queued with `text`; undefined when there were none. */
export function takeImages(agent: Agent, text: string) {
  const [first, ...rest] = agent.queuedImages.get(text) ?? [];
  if (rest.length) agent.queuedImages.set(text, rest);
  else agent.queuedImages.delete(text);
  return first?.length ? first : undefined;
}

/** Forgets a delivered message's images. */
export function delivered(agent: Agent, message: AgentMessage) {
  if (message.role !== "user") return;
  const { content } = message as UserMessage;
  const text =
    typeof content === "string"
      ? content
      : content.map((b) => (b.type === "text" ? b.text : "")).join("");
  takeImages(agent, text);
}
