import type {
  ImageContent,
  TextContent,
  UserMessage,
} from "../../shared/agentTypes";
import type { SentFile } from "../../shared/attachedFiles";
import { readMessage, type SentComment } from "../../shared/sentComments";
import { typedSkill } from "../../shared/skills";

/** A user message as its bubble shows it: the text as typed, and its images, files and diff comments. */
export function readUserMessage({ content }: UserMessage): {
  text: string;
  images: ImageContent[];
  files: SentFile[];
  comments: SentComment[];
} {
  const all =
    typeof content === "string"
      ? content
      : content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n");
  const { text, files, comments } = readMessage(all);
  const images =
    typeof content === "string"
      ? []
      : content.filter((b): b is ImageContent => b.type === "image");
  return { text: typedSkill(text), images, files, comments };
}
