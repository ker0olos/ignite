import { useEffect, useState } from "react";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import { FileTreeEntry } from "@/components/files/FileTreeEntry";
import type { TreeProps } from "@/components/files/FileTree";
import { listDir } from "@/lib/files";

/** A directory's children, loaded lazily and refetched when it changes. */
export function FileTreeEntries({
  dir,
  depth,
  ...props
}: TreeProps & { dir: string; depth: number }) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const { hideGitIgnored } = props;

  useEffect(() => {
    listDir(dir, hideGitIgnored).then(setEntries, () => setEntries([]));
  }, [dir, hideGitIgnored]);

  return entries.map((entry) => (
    <FileTreeEntry
      key={entry.name}
      path={`${dir}/${entry.name}`}
      entry={entry}
      depth={depth}
      {...props}
    />
  ));
}
