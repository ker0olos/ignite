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
import type { Procedure } from "../../shared/procedures";
import type { Reflection } from "../../shared/reflector";
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
  counts: { feature: 14, decision: 6, bugfix: 9, discovery: 21, change: 17 },
  observations: [
    {
      id: 3,
      type: "feature",
      title: "Dark mode follows the system theme",
      subtitle: "Colors moved into CSS variables with a dark set",
      createdAt: now - 20 * 60_000,
      platform: "ignite",
      facts: [
        "Colors live in CSS variables with a light and a dark set",
        "theme.ts follows prefers-color-scheme",
      ],
      files: ["src/theme.ts", "src/styles.css"],
    },
    {
      id: 2,
      type: "decision",
      title: "Settings stay in localStorage",
      createdAt: now - 3 * 3_600_000,
      platform: "claude",
      facts: ["Only the chosen durations are saved, no account needed"],
      files: ["src/settings.ts"],
    },
    {
      id: 1,
      type: "bugfix",
      title: "Break timer showed 04:59 first",
      createdAt: now - 6 * 86_400_000,
      platform: "codex",
      facts: ["The first tick rendered before the countdown was set"],
      files: ["src/timer.ts", "tests/timer.test.ts"],
    },
  ],
});

const DEMO_VERSION: AppVersion = {
  sha: "a2b3c80",
  date: "2026-09-29T12:00:00Z",
  subject: "Merge pull request #20 from ker0olos/feat/multi-session",
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const demoReflections = (tempo: string, now: number): Reflection[] => [
  {
    id: "r1",
    text: "With several things to act on, add them as subtasks first, then ask only the open decisions, one per question.",
    entry: "asking",
    taught: "note",
    at: now - 2 * HOUR,
    when: "several things need acting on",
    evidence: "make subtasks then start with the noise",
    from: {
      conversation: "tempo-reload",
      folder: tempo,
      title: "Keep the timer going across a page reload",
    },
  },
  {
    id: "r2",
    text: "Keep reports short: what changed and what is left, no recap of the steps.",
    entry: "always",
    taught: "reply",
    at: now - 1 * DAY,
    evidence: "too long, just tell me what's done",
    from: {
      conversation: "tempo",
      folder: tempo,
      title: "Add a dark mode to Tempo",
    },
  },
  {
    id: "r3",
    text: "Open the pull request as a draft until the tests pass.",
    entry: "delivering",
    taught: "rewind",
    at: now - 3 * DAY,
    from: {
      conversation: "tempo-tests",
      folder: tempo,
      title: "Write tests for loading and saving settings",
    },
  },
];

const demoProcedures = (tempo: string, now: number): Procedure[] => [
  {
    id: 1,
    title: "Running Tempo's tests",
    steps: ["Run pnpm install", "Run pnpm test"],
    folder: tempo,
    at: now - 5 * HOUR,
    from: {
      conversation: "tempo-tests",
      folder: tempo,
      title: "Write tests for loading and saving settings",
    },
  },
  {
    id: 2,
    title: "Starting Tempo's dev server",
    steps: [
      "Free port 5173 by stopping what holds it",
      "Run pnpm dev in the background",
    ],
    folder: tempo,
    at: now - 2 * DAY,
  },
];

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
export const settingsAnswers = (tempo: string, now = Date.now()) => {
  let reflections = demoReflections(tempo, now);
  let procedures = demoProcedures(tempo, now);
  return {
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
    lessons_list: () => [],
    lessons_remove: () => [],
    procedures_list: () => procedures,
    procedures_remove: (r: { procedure: number }) =>
      (procedures = procedures.filter((p) => p.id !== r.procedure)),
    reflections_list: () => reflections,
    reflections_remove: (r: { reflection: string }) =>
      (reflections = reflections.filter((p) => p.id !== r.reflection)),
    reflections_edit: (r: { reflection: string; text: string }) =>
      (reflections = reflections.flatMap((p) =>
        p.id !== r.reflection
          ? [p]
          : r.text.trim()
            ? [
                {
                  id: p.id,
                  text: r.text.trim(),
                  entry: p.entry,
                  taught: "edit" as const,
                  at: Date.now(),
                },
              ]
            : [],
      )),
    fallback_keys: () => [],
    fallback_key_add: () => [],
    fallback_key_remove: () => [],
    fallback_key_move: () => [],
    app_version: () => DEMO_VERSION,
    app_update: () => ({ updated: false }),
  };
};
