import { useFileExists } from "@/hooks/useFileExists";
import { useOpenFileLink } from "@/hooks/useOpenTab";
import { filePathTarget } from "@/lib/fileLinks";
import { inScratchpad } from "@/lib/scratchpad";

/** A path in a tool call's argument; a link when it's a file. */
export function ArgPath({ text, folder }: { text: string; folder: string }) {
  const open = useOpenFileLink(folder);
  const pad = inScratchpad(text);
  const shown = pad ? (
    <>
      {pad.lead}
      {pad.rest ? (
        <span className="opacity-60">scratchpad/</span>
      ) : (
        "scratchpad"
      )}
      {pad.rest}
    </>
  ) : (
    text
  );
  if (!useFileExists(filePathTarget(folder, text), true)) return shown;
  return (
    <span
      role="link"
      tabIndex={0}
      title={pad ? text : undefined}
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
