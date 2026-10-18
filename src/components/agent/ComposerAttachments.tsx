import type { ImageContent } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { CommentAttachment } from "@/components/agent/CommentAttachment";
import { RemovableAttachment } from "@/components/agent/RemovableAttachment";
import type { DiffComment } from "@/lib/diffComments";

/** What the composer's message carries besides its text, in one strip: images (markable) and diff comments, each removable. */
export function ComposerAttachments({
  images,
  onRemoveImage,
  onEditImage,
  comments,
  session,
  onRemoveComment,
}: {
  images: ImageContent[];
  onRemoveImage: (index: number) => void;
  onEditImage: (index: number, image: ImageContent) => void;
  comments: DiffComment[];
  /** The conversation the comments are for. */
  session: string | null;
  onRemoveComment: (id: number) => void;
}) {
  if (images.length === 0 && comments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-0.5 pt-3">
      {images.map((image, i) => (
        <RemovableAttachment
          key={`image-${i}`}
          label="Remove image"
          onRemove={() => onRemoveImage(i)}
        >
          <ZoomableImage
            image={image}
            className="size-14 rounded-md border object-cover"
            onEdit={(marked) => onEditImage(i, marked)}
          />
        </RemovableAttachment>
      ))}
      {comments.map((c) => (
        <RemovableAttachment
          key={`comment-${c.id}`}
          label="Remove comment"
          onRemove={() => onRemoveComment(c.id)}
        >
          <CommentAttachment comment={c} session={session} />
        </RemovableAttachment>
      ))}
    </div>
  );
}
