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
  // Each listing is kept with its folder, so one finishing after the root changed shows nothing.
  const [listed, setListed] = useState<{ dir: string; entries: DirEntry[] }>({
    dir,
    entries: [],
  });
  const { hideGitIgnored } = props;

  useEffect(() => {
    let live = true;
    listDir(dir, hideGitIgnored).then(
      (entries) => live && setListed({ dir, entries }),
      () => live && setListed({ dir, entries: [] }),
    );
    return () => {
      live = false;
    };
  }, [dir, hideGitIgnored]);

  const entries = listed.dir === dir ? listed.entries : [];
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
