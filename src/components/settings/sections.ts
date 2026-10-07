import type { ReactNode } from "react";
import { isMac } from "@/lib/window";
import {
  Bot,
  Brain,
  Code,
  Globe,
  Info,
  Keyboard,
  Laptop,
  MessageSquare,
  Palette,
  Plug,
  Server,
  Smartphone,
  Sparkles,
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
  Skills: {
    icon: Sparkles,
    brief: "Know-how the agent loads",
    blurb: "Instructions the agent reads when a task calls for them.",
  },
  Chrome: {
    icon: Globe,
    brief: "Browser tools",
    blurb: "Tools that let the agent see and drive Chrome.",
  },
  Memory: {
    icon: Brain,
    brief: "Recall across conversations",
    blurb: "What the agent remembers across conversations, with cmem.",
  },
  Remote: {
    icon: Smartphone,
    brief: "Use it from other devices",
    blurb: "Open the app from your phone or another computer.",
  },
  Mac: {
    icon: Laptop,
    brief: "Glass, sleep",
    blurb: "How the app looks and behaves on macOS.",
  },
  Conversation: {
    icon: MessageSquare,
    brief: "What replies show",
    blurb: "What the agent's replies show.",
  },
  "Keyboard Shortcuts": {
    icon: Keyboard,
    brief: "Hotkeys and actions",
    blurb: "Keyboard shortcuts available in the app.",
  },
  Appearance: {
    icon: Palette,
    brief: "Themes, colors, sidebar",
    blurb: "Colors for the app and code, the sidebar and the file tree.",
  },
  Editor: {
    icon: Code,
    brief: "Font, wrapping, text size",
    blurb: "How files and messages look.",
  },
  About: {
    icon: Info,
    brief: "Version and updates",
    blurb: "The version you're running.",
  },
} satisfies Record<string, { icon: LucideIcon; brief: string; blurb: string }>;

export type Section = keyof typeof SECTIONS;
export const SECTION_NAMES = (Object.keys(SECTIONS) as Section[]).filter(
  (s) => s !== "Mac" || isMac(),
);

export interface Item {
  section: Section;
  title: string;
  description?: string;
  /** Shown after the description, such as keyboard shortcuts; search skips it. */
  hint?: ReactNode;
  /** A mark shown before the title. */
  icon?: ReactNode;
  /** The row element's id, to scroll to it. */
  id?: string;
  /** Extra words search should match. */
  keywords?: string;
  control?: ReactNode;
}

export const serverRowId = (name: string) => `mcp-server-${name}`;
