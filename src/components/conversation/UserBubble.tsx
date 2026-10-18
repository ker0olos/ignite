import type { ReactNode } from "react";
import type { UserMessage } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { userParts } from "@/lib/rewind";

/** The user's turn: text bubble and any attached images, right-aligned; `action` (Edit) beside the text. */
export function UserBubble({
  message,
  action,
}: {
  message: UserMessage;
  action?: ReactNode;
}) {
  const { text, images } = userParts(message);
  if (!text && !images.length) return null;
  return (
    <div className="group flex flex-col items-end gap-2">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {!text && action}
          {images.map((image, i) => (
            <ZoomableImage
              key={i}
              image={image}
              className="max-h-40 max-w-60 rounded-lg border object-contain"
            />
          ))}
        </div>
      )}
      {text && (
        <div className="flex w-full items-center justify-end gap-1">
          {action}
          <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[length:var(--message-text,14px)] whitespace-pre-wrap">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
