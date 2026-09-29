import type { ComponentType } from "react";
import {
  Globe,
  Library,
  Sparkles,
  Terminal,
  type LucideProps,
} from "lucide-react";
import {
  siAtlassian,
  siClaude,
  siCloudflare,
  siCursor,
  siFigma,
  siGithub,
  siHuggingface,
  siLinear,
  siN8n,
  siNeon,
  siSentry,
  siStripe,
  siSupabase,
  siVercel,
  type SimpleIcon,
} from "simple-icons";

/** An icon and its brand colour; no colour means the text colour. */
export type Mark = {
  icon: SimpleIcon | ComponentType<LucideProps>;
  color?: string;
};

// Brand colours too dark to see on a dark background fall back to the text
// colour (GitHub, Cursor are black).
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
  context7: { icon: Library, color: "#00E9A3" },
  github: brand(siGithub),
  playwright: { icon: Globe, color: "#2EAD33" },
  sentry: { icon: siSentry, color: "#A48FE0" },
  supabase: brand(siSupabase),
  linear: brand(siLinear),
  n8n: brand(siN8n),
  stripe: brand(siStripe),
  vercel: brand(siVercel),
  figma: brand(siFigma),
  atlassian: brand(siAtlassian),
  neon: brand(siNeon),
  "cloudflare-docs": brand(siCloudflare),
  "hugging-face": brand(siHuggingface),
};

export const APPS: Record<string, Mark> = {
  "Claude Code": brand(siClaude),
  "Claude Desktop": brand(siClaude),
  Cursor: brand(siCursor),
  Codex: { icon: Terminal },
  "Agent Skills": { icon: Sparkles },
};
