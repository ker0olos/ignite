/** Servers the MCP settings offer to add in one click. */
import { KNOWN_SERVER_PRESETS } from "pi-mcp-adapter/config";
import type { McpEntry } from "./mcpConfig.ts";

export type Preset = {
  id: string;
  name: string;
  summary: string;
  entry: McpEntry;
};

// ponytail: hand-picked on top of the adapter's list; entries checked against
// the servers' docs in Sept 2026 (npm @playwright/mcp, live OAuth endpoints).
const EXTRA_PRESETS: Preset[] = [
  {
    id: "playwright",
    name: "Playwright",
    summary: "Drive a browser to test and debug web apps.",
    entry: { command: "npx", args: ["-y", "@playwright/mcp@0.0.82"] },
  },
  {
    id: "sentry",
    name: "Sentry",
    summary: "Look into errors and issues in your Sentry projects.",
    entry: { url: "https://mcp.sentry.dev/mcp", auth: "oauth" },
  },
  {
    id: "supabase",
    name: "Supabase",
    summary: "Manage your Supabase projects, database and functions.",
    entry: { url: "https://mcp.supabase.com/mcp", auth: "oauth" },
  },
  {
    id: "linear",
    name: "Linear",
    summary: "Find and update Linear issues and projects.",
    entry: { url: "https://mcp.linear.app/mcp", auth: "oauth" },
  },
  {
    id: "n8n",
    name: "n8n",
    summary: "Build and check n8n workflows with docs for every node.",
    entry: {
      command: "npx",
      args: ["-y", "n8n-mcp@2.90.0"],
      env: {
        MCP_MODE: "stdio",
        LOG_LEVEL: "error",
        DISABLE_CONSOLE_OUTPUT: "true",
      },
    },
  },
  {
    id: "stripe",
    name: "Stripe",
    summary: "Work with Stripe customers, payments and docs.",
    entry: { url: "https://mcp.stripe.com", auth: "oauth" },
  },
  {
    id: "vercel",
    name: "Vercel",
    summary: "Manage Vercel projects, deployments and logs.",
    entry: { url: "https://mcp.vercel.com", auth: "oauth" },
  },
  {
    id: "figma",
    name: "Figma",
    summary: "Read Figma designs to turn them into code.",
    entry: { url: "https://mcp.figma.com/mcp", auth: "oauth" },
  },
  {
    id: "atlassian",
    name: "Atlassian",
    summary: "Search and update Jira issues and Confluence pages.",
    entry: { url: "https://mcp.atlassian.com/v1/mcp", auth: "oauth" },
  },
  {
    id: "neon",
    name: "Neon",
    summary: "Manage Neon Postgres projects, branches and queries.",
    entry: { url: "https://mcp.neon.tech/mcp", auth: "oauth" },
  },
  {
    id: "cloudflare-docs",
    name: "Cloudflare Docs",
    summary: "Look up Cloudflare's developer documentation.",
    entry: { url: "https://docs.mcp.cloudflare.com/mcp" },
  },
  {
    id: "hugging-face",
    name: "Hugging Face",
    summary: "Search models, datasets, Spaces and papers.",
    entry: { url: "https://huggingface.co/mcp" },
  },
];

// Chrome DevTools: the agent has its own chrome_* tools.
const DROPPED = new Set([
  "deepwiki",
  "parallel-search",
  "notion",
  "chrome-devtools",
]);

/** pi-mcp-adapter's presets we keep, then ours. */
export const PRESETS: readonly Preset[] = [
  ...KNOWN_SERVER_PRESETS.filter((p) => !DROPPED.has(p.id)).map(
    ({ id, name, summary, entry }) => ({
      id,
      name,
      summary,
      entry: entry as McpEntry,
    }),
  ),
  ...EXTRA_PRESETS,
];
