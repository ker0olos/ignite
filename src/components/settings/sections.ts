import type { ReactNode } from "react";
import {
  Bot,
  Brain,
  Code,
  FolderTree,
  Info,
  MessageSquare,
  Palette,
  Plug,
  Server,
  type LucideIcon,
} from "lucide-react";

/** `brief` sits under the name in the nav; `blurb` under the section heading. */
export const SECTIONS = {
  Providers: {
    icon: Plug,
    brief: "Accounts and sign-in",
    blurb: "Accounts the agent signs in with.",
  },
  Agent: {
    icon: Bot,
    brief: "Questions and subagents",
    blurb: "When the agent asks you, and what it hands off.",
  },
  MCP: {
    icon: Server,
    brief: "Tools from other apps",
    blurb: "Tools the agent can use from other apps and services.",
  },
  Memory: {
    icon: Brain,
    brief: "Recall across sessions",
    blurb: "What the agent remembers across sessions, with cmem.",
  },
  Conversation: {
    icon: MessageSquare,
    brief: "What replies show",
    blurb: "What the agent's replies show.",
  },
  Appearance: {
    icon: Palette,
    brief: "Themes and colors",
    blurb: "Colors for the app and code.",
  },
  Editor: {
    icon: Code,
    brief: "Font and wrapping",
    blurb: "How files look in the viewer.",
  },
  Files: {
    icon: FolderTree,
    brief: "What the tree shows",
    blurb: "What the file tree shows.",
  },
  About: {
    icon: Info,
    brief: "Version and updates",
    blurb: "The version you're running.",
  },
} satisfies Record<string, { icon: LucideIcon; brief: string; blurb: string }>;

export type Section = keyof typeof SECTIONS;
export const SECTION_NAMES = Object.keys(SECTIONS) as Section[];

export interface Item {
  section: Section;
  title: string;
  description?: string;
  /** A mark shown before the title. */
  icon?: ReactNode;
  /** The row element's id, to scroll to it. */
  id?: string;
  /** Extra words search should match. */
  keywords?: string;
  control?: ReactNode;
}

export const serverRowId = (name: string) => `mcp-server-${name}`;
