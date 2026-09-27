import type { ComponentType } from "react";
import {
  BookOpen,
  Globe,
  Library,
  Plug,
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
import { cn } from "@/lib/utils";

/** An icon and its brand colour; no colour means the text colour. */
type Mark = { icon: SimpleIcon | ComponentType<LucideProps>; color?: string };

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
const PRESETS: Record<string, Mark> = {
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

const APPS: Record<string, Mark> = {
  "Claude Code": brand(siClaude),
  "Claude Desktop": brand(siClaude),
  Cursor: brand(siCursor),
  Codex: { icon: Terminal },
};

function Glyph({ mark, className }: { mark: Mark; className?: string }) {
  const style = { color: mark.color };
  const classes = cn(
    "size-4 shrink-0",
    !mark.color && "text-foreground",
    className,
  );
  if (!("path" in mark.icon)) {
    const Lucide = mark.icon;
    return <Lucide className={classes} style={style} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={classes}
      style={style}
    >
      <title>{mark.icon.title}</title>
      <path d={mark.icon.path} />
    </svg>
  );
}

/** A preset's mark on a tile tinted with its brand colour. */
export function PresetTile({ id }: { id: string }) {
  const mark = PRESETS[id] ?? { icon: Plug };
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
      style={
        mark.color
          ? {
              backgroundColor: `color-mix(in oklab, ${mark.color} 16%, transparent)`,
            }
          : undefined
      }
    >
      <Glyph mark={mark} />
    </div>
  );
}

/** The mark of an app whose MCP servers can be imported. */
export function AppIcon({ app }: { app: string }) {
  return <Glyph mark={APPS[app] ?? { icon: Plug }} />;
}
