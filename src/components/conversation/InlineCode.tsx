import type { ReactNode } from "react";
import { LinkPill } from "@/components/conversation/LinkPill";
import { useFileExists } from "@/hooks/useFileExists";
import { filePathTarget, looksLikeFilePath } from "@/lib/fileLinks";

/** Inline code; a link when it names a file or folder that exists. */
export function InlineCode({
  text,
  folder,
  children,
  onOpen,
}: {
  text: string;
  folder: string;
  children: ReactNode;
  onOpen: (text: string) => void;
}) {
  const path = looksLikeFilePath(text) ? filePathTarget(folder, text) : null;
  if (!useFileExists(path)) {
    return (
      <code className="rounded bg-muted px-1 font-mono text-[0.92em]">
        {children}
      </code>
    );
  }
  return (
    <LinkPill kind="file" onOpen={() => onOpen(text)}>
      {children}
    </LinkPill>
  );
}
