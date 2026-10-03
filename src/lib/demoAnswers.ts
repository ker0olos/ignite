/**
 * What the demo host answers outside conversations: connected providers,
 * MCP servers, memory, the app's version and the demo projects' files.
 * All made up; nothing reads the Mac or signs in.
 */
import type {
  AppVersion,
  McpServer,
  ProviderStatus,
} from "../../shared/hostProtocol";
import type { McpCatalog } from "../../shared/mcpCatalog";
import type { SkillCatalog, SkillEntry } from "../../shared/skills";
import type { MemoryStatus } from "../../shared/memory";

/** Claude through Claude Code and ChatGPT through Codex, both connected. */
export const DEMO_STATUSES: ProviderStatus[] = [
  { id: "claude-code", connected: true, method: "oauth", installed: true },
  { id: "anthropic", connected: false },
  { id: "openai-codex", connected: true, method: "oauth", viaCodex: true },
  { id: "openai", connected: false },
];

const DEMO_MCP: McpServer[] = [
  {
    name: "github",
    enabled: true,
    config: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      headers: {},
    },
    status: "connected",
    tools: ["search_issues", "get_pull_request", "create_issue"],
  },
  {
    name: "playwright",
    enabled: true,
    config: {
      type: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: {},
    },
    status: "idle",
    tools: ["browser_navigate", "browser_snapshot", "browser_click"],
  },
];

const DEMO_CATALOG: McpCatalog = { presets: [], sources: [] };

const DEMO_SKILLS: SkillEntry[] = [
  {
    id: "release-notes",
    name: "release-notes",
    description: "Drafts release notes from recent commits.",
    enabled: true,
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    description: "A bundle of skills for building UI.",
    enabled: true,
    skills: [
      {
        name: "component-layout",
        description: "Lays out a new component to match the app's style.",
      },
    ],
  },
];

const DEMO_SKILL_CATALOG: SkillCatalog = { sources: [] };

const DEMO_MEMORY = (now: number): MemoryStatus => ({
  state: "running",
  observations: [
    {
      id: 3,
      type: "feature",
      title: "Dark mode follows the system theme",
      subtitle: "Colors moved into CSS variables with a dark set",
      createdAt: now - 20 * 60_000,
      platform: "ignite",
    },
    {
      id: 2,
      type: "decision",
      title: "Settings stay in localStorage",
      createdAt: now - 3 * 3_600_000,
      platform: "claude",
    },
    {
      id: 1,
      type: "bugfix",
      title: "Break timer showed 04:59 first",
      createdAt: now - 6 * 86_400_000,
      platform: "codex",
    },
  ],
});

const DEMO_VERSION: AppVersion = {
  sha: "a2b3c80",
  date: "2026-09-29T12:00:00Z",
  subject: "Merge pull request #20 from ker0olos/feat/multi-session",
};

/** Each demo project's files, as the command center searches them. */
export const DEMO_FILES: Record<"tempo" | "pantry", string[]> = {
  tempo: [
    "README.md",
    "index.html",
    "package.json",
    "src/main.ts",
    "src/settings.ts",
    "src/styles.css",
    "src/theme.ts",
    "src/timer.ts",
    "tests/settings.test.ts",
    "tests/timer.test.ts",
  ],
  pantry: [
    "README.md",
    "package.json",
    "src/db.ts",
    "src/recipes.ts",
    "src/server.ts",
    "tests/recipes.test.ts",
  ],
};

/** The demo host's answers to requests that aren't about a conversation. */
export const settingsAnswers = (now = Date.now()) => ({
  status: () => DEMO_STATUSES,
  login: () => DEMO_STATUSES[0],
  logout: () => DEMO_STATUSES[0],
  cancel_login: () => undefined,
  mcp_list: () => DEMO_MCP,
  mcp_save: () => DEMO_MCP,
  mcp_remove: () => DEMO_MCP,
  mcp_set_enabled: () => DEMO_MCP,
  mcp_sign_in: () => DEMO_MCP,
  mcp_add_preset: () => DEMO_MCP,
  mcp_import: () => DEMO_MCP,
  mcp_catalog: () => DEMO_CATALOG,
  skills_list: () => DEMO_SKILLS,
  skills_set_enabled: () => DEMO_SKILLS,
  skills_remove: () => DEMO_SKILLS,
  skills_catalog: () => DEMO_SKILL_CATALOG,
  skills_import: () => DEMO_SKILLS,
  memory_status: () => DEMO_MEMORY(now),
  memory_changed: () => undefined,
  app_version: () => DEMO_VERSION,
  app_update: () => ({ updated: false }),
});
