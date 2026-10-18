import type { SentFile } from "../../../shared/attachedFiles";
import { FileIcon } from "@/components/files/FileIcon";
import { basename } from "@/lib/paths";

/** A file dropped into the composer's message, as tall as an image's thumbnail: its icon and name. */
export function FileAttachment({ file }: { file: SentFile }) {
  return (
    <div
      title={file.path}
      className="flex h-14 w-52 items-center gap-2 rounded-md border bg-muted/40 px-2 text-[13px]"
    >
      <FileIcon name={file.path} className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{basename(file.path)}</span>
    </div>
  );
}
