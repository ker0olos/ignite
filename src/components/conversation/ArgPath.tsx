import { useFileExists } from "@/hooks/useFileExists";
import { useOpenFileLink } from "@/hooks/useOpenTab";
import { filePathTarget } from "@/lib/fileLinks";
import { inScratchpad } from "@/lib/paths";

/** A path in a tool call's argument; a link when it's a file. */
export function ArgPath({ text, folder }: { text: string; folder: string }) {
  const open = useOpenFileLink(folder);
  const shown = inScratchpad(text) ?? text;
  if (!useFileExists(filePathTarget(folder, text), true)) return shown;
  return (
    <span
      role="link"
      tabIndex={0}
      title={shown === text ? undefined : text}
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
      {shown}
    </span>
  );
}
