import {
  Braces,
  Code,
  CodeXml,
  File,
  Hash,
  Image,
  Lock,
  Terminal,
  TextAlignStart,
  type LucideIcon,
} from "lucide-react";

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

/** Monochrome glyph for a file, picked by extension. */
export function fileIcon(name: string): LucideIcon {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return (name.includes(".") && BY_EXT.get(ext)) || File;
}
