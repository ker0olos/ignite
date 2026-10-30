/**
 * pi labels serialized messages `[User]:`… without escaping their text, so a page that writes
 * `[User]: …` reads to a summarizer as the user's turn (arXiv 2610.29869); compaction too.
 */
import {
  serializeConversation,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type Llm = Parameters<typeof serializeConversation>[0];
type Block = { type: string; text?: string };

const LABEL = /\[\s*(user|assistant(?: tool calls)?|tool result)\s*\]\s*:/gi;

/** `text` with pi's role labels written in it marked as quoted. */
export const escapeLabels = (text: string) =>
  text.replace(LABEL, (_, role: string) => `[quoted ${role}]:`);

const escapeBlock = (c: Block) =>
  c.type === "text" && c.text ? { ...c, text: escapeLabels(c.text) } : c;

/** Copies of `messages` whose text can't pass for another message's label; the originals stay as they are. */
export function unforged<T>(messages: readonly T[]): T[] {
  return messages.map((m) => {
    const { content } = m as { content?: unknown };
    if (typeof content === "string")
      return { ...m, content: escapeLabels(content) };
    if (!Array.isArray(content)) return m;
    return { ...m, content: (content as Block[]).map(escapeBlock) };
  });
}

/** pi's serializeConversation of `messages`, their own text unable to forge a role. */
export const conversationText = (messages: readonly unknown[]) =>
  serializeConversation(unforged(messages) as Llm);

export default function roleLabels(pi: ExtensionAPI) {
  // pi's summary reads this same preparation once the hook returns.
  pi.on("session_before_compact", ({ preparation }) => {
    preparation.messagesToSummarize = unforged(preparation.messagesToSummarize);
    preparation.turnPrefixMessages = unforged(preparation.turnPrefixMessages);
  });
}
