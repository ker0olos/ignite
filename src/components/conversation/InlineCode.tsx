import type { ReactNode } from "react";
import { useFileExists } from "@/hooks/useFileExists";
import { filePathTarget, looksLikeFilePath } from "@/lib/fileLinks";

const CODE = "rounded bg-muted px-1 font-mono text-[0.92em]";

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
  if (!useFileExists(path)) return <code className={CODE}>{children}</code>;
  return (
    <button
      type="button"
      className={`${CODE} underline decoration-current/40 underline-offset-2 hover:decoration-current`}
      onClick={() => onOpen(text)}
    >
      {children}
    </button>
  );
}
