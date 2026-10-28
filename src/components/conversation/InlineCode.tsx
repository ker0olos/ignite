import { openUrl } from "@tauri-apps/plugin-opener";
import type { ReactNode } from "react";
import { LinkPill } from "@/components/conversation/LinkPill";
import { useFileExists } from "@/hooks/useFileExists";
import { filePathTarget, looksLikeFilePath } from "@/lib/fileLinks";
import { selectAllOf } from "@/lib/selectText";

const URL = /^https?:\/\/\S+$/;

/** Inline code; a link when it's a URL, or names a file or folder that exists. */
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
  const exists = useFileExists(path);
  if (URL.test(text)) {
    return (
      <LinkPill kind="url" onOpen={() => void openUrl(text).catch(() => {})}>
        {children}
      </LinkPill>
    );
  }
  if (!exists) {
    return (
      <code
        className="rounded bg-code/12 px-1 font-mono text-[0.92em] text-code box-decoration-clone"
        onClick={(e) => selectAllOf(e.currentTarget)}
      >
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
