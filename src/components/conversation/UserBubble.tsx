import type { UserMessage } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { SentCommentCard } from "@/components/conversation/SentCommentCard";
import { SentFileCard } from "@/components/conversation/SentFileCard";
import { readUserMessage } from "@/lib/userMessage";

/** The user's turn: text bubble, any attached images, files and diff comments, right-aligned. */
export function UserBubble({ message }: { message: UserMessage }) {
  const { text, images, files, comments } = readUserMessage(message);
  if (!text && !images.length && !files.length && !comments.length) return null;
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
      {files.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {files.map((f, i) => (
            <SentFileCard key={i} file={f} />
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
