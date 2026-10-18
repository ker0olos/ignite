import type { ImageContent } from "../../../shared/agentTypes";
import type { SentFile } from "../../../shared/attachedFiles";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { CommentAttachment } from "@/components/agent/CommentAttachment";
import { FileAttachment } from "@/components/agent/FileAttachment";
import { RemovableAttachment } from "@/components/agent/RemovableAttachment";
import type { DiffComment } from "@/lib/diffComments";

/** What the composer's message carries besides its text, in one strip: images (markable), files and diff comments, each removable. */
export function ComposerAttachments({
  images,
  onRemoveImage,
  onEditImage,
  attached: { files, removeFile, comments, removeComment },
}: {
  images: ImageContent[];
  onRemoveImage: (index: number) => void;
  onEditImage: (index: number, image: ImageContent) => void;
  /** The message's files and diff comments, and removing one. */
  attached: {
    files: SentFile[];
    removeFile: (index: number) => void;
    comments: DiffComment[];
    removeComment: (id: number) => void;
  };
}) {
  if (images.length + files.length + comments.length === 0) return null;
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
      {files.map((f, i) => (
        <RemovableAttachment
          key={`file-${i}`}
          label="Remove file"
          onRemove={() => removeFile(i)}
        >
          <FileAttachment file={f} />
        </RemovableAttachment>
      ))}
      {comments.map((c) => (
        <RemovableAttachment
          key={`comment-${c.id}`}
          label="Remove comment"
          onRemove={() => removeComment(c.id)}
        >
          <CommentAttachment comment={c} />
        </RemovableAttachment>
      ))}
    </div>
  );
}
