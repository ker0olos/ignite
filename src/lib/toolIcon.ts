import type { ComponentType } from "react";
import {
  AudioLines,
  Bot,
  Brain,
  Code,
  Eraser,
  File,
  Folder,
  GitBranch,
  Globe,
  GraduationCap,
  Hourglass,
  Image,
  LayoutTemplate,
  ListChecks,
  ListPlus,
  ListTree,
  MessageCircleQuestion,
  Pencil,
  Plug,
  Search,
  Smartphone,
  Square,
  Terminal,
  Video,
  Wrench,
  type LucideProps,
} from "lucide-react";
import {
  ARTIFACT_TOOL,
  AUDIO_TOOL,
  BASH_STOP_TOOL,
  BASH_WAIT_TOOL,
  IMAGE_TOOL,
  LEGACY_HTML_TOOL,
  VIDEO_TOOL,
  type ToolCall,
} from "../../shared/agentTypes";
import { CODEMODE_TOOL } from "../../shared/codemode";
import { GH_TOOL, GIT_TOOL } from "../../shared/git";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../../shared/lessons";
import { ASK_TOOL } from "../../shared/questions";
import { SUBAGENT_TOOL } from "../../shared/subagents";
import { TASK_ADD_TOOL, TASK_TOOL } from "../../shared/tasks";
import { PRESETS, type Mark } from "@/components/mcp/marks";
import { mcpCall } from "./mcpToolCall";
import { LEGACY_MCP_SCRIPT } from "./toolLabels";

/** How a brand's tile is drawn: its colour with a white glyph, the text colour on the page's (a near-black brand), or the card's with a coloured glyph (a light brand). */
export type TileTone = "brand" | "inverse" | "card";

/** `plain` (built-in tools) draws the glyph alone, without a tile. */
export type ToolIcon =
  | {
      kind: "lucide";
      icon: ComponentType<LucideProps>;
      color?: string;
      plain?: boolean;
    }
  | { kind: "brand"; path: string; hex: string; tone: TileTone }
  | { kind: "done" };

const luminance = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The tile a brand colour (hex without `#`) is drawn on. */
export function tileTone(hex: string): TileTone {
  const l = luminance(hex);
  if (l < 40) return "inverse";
  return l > 150 ? "card" : "brand";
}

/** A tile's fill for its icon (a brand tile's own colour is set inline). */
export function tileClass(icon: ToolIcon) {
  if (icon.kind === "done") return "border-success bg-success text-background";
  if (icon.kind === "lucide") return "bg-muted";
  return { brand: "", inverse: "bg-primary", card: "bg-card" }[icon.tone];
}

const TOOL_ICONS: Record<string, ComponentType<LucideProps>> = {
  read: File,
  write: Pencil,
  edit: Pencil,
  outline: ListTree,
  grep: Search,
  find: Search,
  ls: Folder,
  bash: Terminal,
  terminal_read: Terminal,
  [GIT_TOOL]: GitBranch,
  [CODEMODE_TOOL]: Code,
  [LEGACY_MCP_SCRIPT]: Code,
  [ASK_TOOL]: MessageCircleQuestion,
  [SUBAGENT_TOOL]: Bot,
  [IMAGE_TOOL]: Image,
  [AUDIO_TOOL]: AudioLines,
  [VIDEO_TOOL]: Video,
  [ARTIFACT_TOOL]: LayoutTemplate,
  [LEGACY_HTML_TOOL]: LayoutTemplate,
  [TASK_ADD_TOOL]: ListPlus,
  [TASK_TOOL]: ListChecks,
  [BASH_STOP_TOOL]: Square,
  [BASH_WAIT_TOOL]: Hourglass,
  [LESSON_ADD_TOOL]: GraduationCap,
  [LESSON_REMOVE_TOOL]: Eraser,
  adb: Smartphone,
  adb_screenshot: Smartphone,
  web_search: Search,
};

const BY_LENGTH = Object.keys(PRESETS).sort((a, b) => b.length - a.length);

/** The preset mark of an MCP server, matched on its name (`github-mcp` is GitHub). */
function serverMark(server: string | undefined): Mark | undefined {
  const name = server?.toLowerCase() ?? "";
  const key =
    BY_LENGTH.find((k) => name === k) ??
    BY_LENGTH.find((k) => name.includes(k));
  return key ? PRESETS[key] : undefined;
}

function markIcon(mark: Mark): ToolIcon {
  if (!("path" in mark.icon)) {
    return { kind: "lucide", icon: mark.icon, color: mark.color };
  }
  const { hex, path } = mark.icon;
  return { kind: "brand", path, hex: `#${hex}`, tone: tileTone(hex) };
}

/** An MCP server's display name: its brand's, else its own. */
export function serverName(server: string) {
  const mark = serverMark(server);
  return mark && "path" in mark.icon ? mark.icon.title : server;
}

/** The icon a tool call's tile shows. */
export function toolIcon(call: ToolCall): ToolIcon {
  const mcp = mcpCall(call.name, call.arguments);
  if (mcp) {
    const server =
      mcp.kind === "call" || mcp.kind === "connect" ? mcp.server : undefined;
    const mark = serverMark(server);
    return mark ? markIcon(mark) : { kind: "lucide", icon: Plug };
  }
  if (call.name === GH_TOOL) return markIcon(PRESETS.github);
  const icon = builtInIcon(call.name);
  // Any other tool is an extension's or an MCP server's, so it keeps a tile.
  return icon
    ? { kind: "lucide", icon, plain: true }
    : { kind: "lucide", icon: Wrench };
}

function builtInIcon(name: string) {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name];
  if (name.startsWith("chrome_")) return Globe;
  return name.startsWith("memory_") ? Brain : undefined;
}

/** The Explored row's icon, over consecutive reads and searches. */
export const EXPLORE_ICON: ToolIcon = {
  kind: "lucide",
  icon: Search,
  plain: true,
};
