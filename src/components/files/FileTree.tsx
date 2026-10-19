import { FileTreeEntries } from "@/components/files/FileTreeEntries";

export type TreeProps = {
  selected: string | null;
  onOpenFile: (path: string) => void;
  hideGitIgnored: boolean;
  /** The path a folder's open state is remembered by, the same in every worktree of `folder`. */
  rememberAs: (path: string) => string;
};

/** Lazy directory tree of `root` (`folder` or a worktree of it): folders load their children when first expanded. */
export function FileTree({
  root,
  folder,
  ...props
}: Omit<TreeProps, "rememberAs"> & { root: string; folder: string }) {
  return (
    <FileTreeEntries
      dir={root}
      depth={0}
      rememberAs={(path) => folder + path.slice(root.length)}
      {...props}
    />
  );
}
