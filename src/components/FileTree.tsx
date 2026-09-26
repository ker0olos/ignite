import { createElement, useEffect, useState } from "react";
import { readDir, type DirEntry } from "@tauri-apps/plugin-fs";
import {
  Braces,
  ChevronRight,
  Code,
  CodeXml,
  File,
  Folder,
  FolderOpen,
  Hash,
  Image,
  Lock,
  Terminal,
  TextAlignStart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: [LucideIcon, string][] = [
  [Hash, "css scss sass less"],
  [CodeXml, "html htm xml svg tsx jsx vue svelte astro"],
  [Code, "ts mts cts js mjs cjs rs py go rb swift kt java c h cpp zig lua gd"],
  [Braces, "json jsonc json5"],
  [TextAlignStart, "md mdx txt rst"],
  [Image, "png jpg jpeg gif webp ico icns avif"],
  [Terminal, "sh bash zsh fish"],
  [Lock, "lock lockb"],
];
const BY_EXT = new Map(
  ICONS.flatMap(([icon, exts]) => exts.split(" ").map((e) => [e, icon])),
);

function fileIcon(name: string) {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return (name.includes(".") && BY_EXT.get(ext)) || File;
}

const HIDDEN = new Set([".git", ".DS_Store"]);

// ponytail: no fs watching, the tree reloads only when a folder is re-expanded or reopened
async function list(dir: string) {
  const entries = await readDir(dir);
  return entries
    .filter((e) => !HIDDEN.has(e.name))
    .sort(
      (a, b) =>
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name),
    );
}

export function FileTree({ root }: { root: string }) {
  return <Entries dir={root} depth={0} />;
}

function Entries({ dir, depth }: { dir: string; depth: number }) {
  const [entries, setEntries] = useState<DirEntry[]>([]);

  useEffect(() => {
    list(dir).then(setEntries, () => setEntries([]));
  }, [dir]);

  return entries.map((entry) => (
    <Entry
      key={entry.name}
      path={`${dir}/${entry.name}`}
      entry={entry}
      depth={depth}
    />
  ));
}

function Entry({
  path,
  entry,
  depth,
}: {
  path: string;
  entry: DirEntry;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const icon = createElement(
    entry.isDirectory ? (open ? FolderOpen : Folder) : fileIcon(entry.name),
    { className: "size-4 shrink-0 text-muted-foreground" },
  );

  return (
    <>
      <button
        title={entry.name}
        onClick={() => entry.isDirectory && setOpen(!open)}
        style={{ paddingLeft: 4 + depth * 12 }}
        className="flex h-6 w-full items-center gap-1 rounded-md pr-2 text-left text-[13px] hover:bg-sidebar-accent/50"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
            !entry.isDirectory && "invisible",
          )}
        />
        {icon}
        <span className="ml-0.5 truncate">{entry.name}</span>
      </button>
      {open && <Entries dir={path} depth={depth + 1} />}
    </>
  );
}
