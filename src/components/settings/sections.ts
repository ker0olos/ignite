import type { ReactNode } from "react";
import {
  Code,
  FolderTree,
  MessageSquare,
  Palette,
  Plug,
  Server,
  type LucideIcon,
} from "lucide-react";

export const SECTIONS = {
  Providers: { icon: Plug, blurb: "Accounts the agent signs in with." },
  MCP: {
    icon: Server,
    blurb: "Tools the agent can use from other apps and services.",
  },
  Appearance: { icon: Palette, blurb: "Colors for the app and code." },
  Editor: { icon: Code, blurb: "How files look in the viewer." },
  Files: { icon: FolderTree, blurb: "What the file tree shows." },
  Conversation: {
    icon: MessageSquare,
    blurb: "What the agent's replies show.",
  },
} satisfies Record<string, { icon: LucideIcon; blurb: string }>;

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
