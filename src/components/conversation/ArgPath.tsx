import { useFileExists } from "@/hooks/useFileExists";
import { useOpenFileLink } from "@/hooks/useOpenTab";
import { filePathTarget } from "@/lib/fileLinks";

/** A path in a tool call's argument; a link when it exists. */
export function ArgPath({ text, folder }: { text: string; folder: string }) {
  const open = useOpenFileLink(folder);
  if (!useFileExists(filePathTarget(folder, text))) return text;
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        open(text);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        open(text);
      }}
      className="cursor-pointer underline decoration-current/40 underline-offset-2 hover:text-foreground hover:decoration-current"
    >
      {text}
    </span>
  );
}
