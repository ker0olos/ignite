import type { SentFile } from "../../../shared/attachedFiles";
import { FileIcon } from "@/components/files/FileIcon";
import { basename } from "@/lib/paths";

/** A file a message carried: its icon and name, its path on hover. */
export function SentFileCard({ file }: { file: SentFile }) {
  return (
    <div
      title={file.path}
      className="flex max-w-64 items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[13px]"
    >
      <FileIcon name={file.path} className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{basename(file.path)}</span>
    </div>
  );
}
