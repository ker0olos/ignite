import type {
  ImageContent,
  TextContent,
  UserMessage,
} from "../../../shared/agentTypes";
import { readComments } from "../../../shared/sentComments";
import { typedSkill } from "../../../shared/skills";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { SentCommentCard } from "@/components/conversation/SentCommentCard";

/** The user's turn: text bubble, any attached images and diff comments, right-aligned. */
export function UserBubble({ message }: { message: UserMessage }) {
  const { text: written, comments } = readComments(
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
  );
  const text = typedSkill(written);
  const images =
    typeof message.content === "string"
      ? []
      : message.content.filter((b): b is ImageContent => b.type === "image");
  if (!text && !images.length && !comments.length) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {images.map((image, i) => (
            <ZoomableImage
              key={i}
              image={image}
              className="max-h-40 max-w-60 rounded-lg border object-contain"
            />
          ))}
        </div>
      )}
      {comments.length > 0 && (
        <div className="flex w-full max-w-[85%] flex-col items-end gap-1.5">
          {comments.map((c, i) => (
            <SentCommentCard key={i} comment={c} />
          ))}
        </div>
      )}
      {text && (
        <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[length:var(--message-text,14px)] whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
