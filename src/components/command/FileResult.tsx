import { createElement } from "react";
import { pathRanges } from "../../../shared/fuzzy";
import { Highlight } from "@/components/command/Highlight";
import { CommandShortcut } from "@/components/ui/command";
import { fileIcon } from "@/lib/fileIcons";
import { basename } from "@/lib/paths";

/** A found file's row: its name, then the folders it's in, marked where `query` matched. */
export function FileResult({
  folder,
  path,
  query,
}: {
  folder: string;
  path: string;
  query: string;
}) {
  const ranges = pathRanges(query, path);
  const cut = path.lastIndexOf("/") + 1;
  return (
    <>
      {createElement(fileIcon(path), { className: "text-muted-foreground" })}
      <span className="shrink-0">
        <Highlight text={path.slice(cut)} ranges={ranges} offset={cut} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {cut > 0 && <Highlight text={path.slice(0, cut - 1)} ranges={ranges} />}
      </span>
      <CommandShortcut className="shrink-0 text-[13px] tracking-normal">
        {basename(folder)}
      </CommandShortcut>
    </>
  );
}
