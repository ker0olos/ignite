import { FileTreeEntries } from "@/components/files/FileTreeEntries";

export type TreeProps = {
  selected: string | null;
  onOpenFile: (path: string) => void;
  hideGitIgnored: boolean;
};

/** Lazy directory tree: folders load their children when first expanded. */
export function FileTree({ root, ...props }: TreeProps & { root: string }) {
  return <FileTreeEntries dir={root} depth={0} {...props} />;
}
