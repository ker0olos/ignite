import type { ReactNode } from "react";
import { isMac } from "@/lib/window";
import {
  Bot,
  Brain,
  Code,
  Globe,
  GraduationCap,
  Info,
  Keyboard,
  Laptop,
  Lightbulb,
  ListChecks,
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
    blurb: "What the agent remembers across conversations.",
  },
  Lessons: {
    icon: GraduationCap,
    brief: "What the agent learned from you",
    blurb:
      "What the agent learned from your corrections, read in every conversation they apply to.",
  },
  Procedures: {
    icon: ListChecks,
    brief: "Fixes for failed commands",
    blurb:
      "How past conversations got past commands that failed, in each folder. A new conversation is offered the ones its first message needs.",
  },
  Reflector: {
    icon: Lightbulb,
    brief: "How you want it to work",
    blurb:
      "Learns how you want the agent to work from your feedback: your replies, notes on its questions, calls you deny and messages you rewind. Each point is read where it applies, in every new conversation.",
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

const LEARNING_TABS = ["Memory", "Lessons", "Procedures", "Reflector"] as const;
export type LearningTab = (typeof LEARNING_TABS)[number];

export const LEARNING = {
  icon: Brain,
  brief: "What carries between conversations",
  blurb:
    "What the agent carries from one conversation to the next. Each part has its own switch.",
};

export const isLearningTab = (s: Section): s is LearningTab =>
  (LEARNING_TABS as readonly Section[]).includes(s);

export interface NavEntry {
  label: string;
  icon: LucideIcon;
  brief: string;
  sections: Section[];
}

/** The nav's entries: every section, with the learning ones collapsed into one at Memory's place. */
export function navEntries(): NavEntry[] {
  return SECTION_NAMES.flatMap((s): NavEntry[] => {
    if (s === LEARNING_TABS[0]) {
      return [{ label: "Learning", ...LEARNING, sections: [...LEARNING_TABS] }];
    }
    if (isLearningTab(s)) return [];
    return [
      {
        label: s,
        icon: SECTIONS[s].icon,
        brief: SECTIONS[s].brief,
        sections: [s],
      },
    ];
  });
}

export interface Item {
  section: Section;
  title: string;
  /** Shown in place of the title text, which still keys and names the row. */
  titleView?: ReactNode;
  description?: string;
  /** Shown after the description, such as keyboard shortcuts; search skips it. */
  hint?: ReactNode;
  /** A mark shown before the title. */
  icon?: ReactNode;
  /** The row element's id, to scroll to it. */
  id?: string;
  /** Extra words search should match. */
  keywords?: string;
  /** Lines the control up with the title rather than the row's middle, for rows of several lines. */
  alignTop?: boolean;
  /** In a card of its own above the section's other rows, as a section's switch is. */
  alone?: boolean;
  control?: ReactNode;
}

export const serverRowId = (name: string) => `mcp-server-${name}`;

/** Search's match test, and the rows shown by section: every match while searching, else the chosen section's. */
export function shownGroups(items: Item[], query: string, section: Section) {
  const q = query.trim().toLowerCase();
  const matches = (i: Item) =>
    `${i.section} ${i.title} ${i.description ?? ""} ${i.keywords ?? ""}`
      .toLowerCase()
      .includes(q);
  const visible = q
    ? items.filter(matches)
    : items.filter((i) => i.section === section);
  const groups = SECTION_NAMES.map(
    (s) => [s, visible.filter((i) => i.section === s)] as const,
  ).filter(([, rows]) => rows.length > 0);
  return { matches, groups };
}
