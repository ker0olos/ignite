import type { ComponentType } from "react";
import {
  BookOpen,
  Globe,
  Library,
  Search,
  Terminal,
  type LucideProps,
} from "lucide-react";
import {
  siClaude,
  siCursor,
  siGithub,
  siGooglechrome,
  siLinear,
  siNotion,
  siSentry,
  siSupabase,
  type SimpleIcon,
} from "simple-icons";

/** An icon and its brand colour; no colour means the text colour. */
export type Mark = {
  icon: SimpleIcon | ComponentType<LucideProps>;
  color?: string;
};

// Brand colours too dark to see on a dark background fall back to the text
// colour (Notion, GitHub, Cursor are black).
function brand(icon: SimpleIcon): Mark {
  const [r, g, b] = [0, 2, 4].map((i) =>
    parseInt(icon.hex.slice(i, i + 2), 16),
  );
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 90;
  return { icon, color: light ? `#${icon.hex}` : undefined };
}

// Brands missing from Simple Icons get a Lucide icon for what they do, in the
// brand's colour where it has a clear one.
export const PRESETS: Record<string, Mark> = {
  deepwiki: { icon: BookOpen },
  context7: { icon: Library, color: "#00E9A3" },
  "parallel-search": { icon: Search },
  notion: brand(siNotion),
  github: brand(siGithub),
  "chrome-devtools": brand(siGooglechrome),
  playwright: { icon: Globe, color: "#2EAD33" },
  sentry: { icon: siSentry, color: "#A48FE0" },
  supabase: brand(siSupabase),
  linear: brand(siLinear),
};

export const APPS: Record<string, Mark> = {
  "Claude Code": brand(siClaude),
  "Claude Desktop": brand(siClaude),
  Cursor: brand(siCursor),
  Codex: { icon: Terminal },
};
