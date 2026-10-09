/**
 * cmem (cmem.ai, also called claude-mem) on this Mac: finding its
 * local worker, the app's on/off setting for it, and what it remembers.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, matchesGlob } from "node:path";
import { parse as parseToml } from "smol-toml";
import type {
  MemoryObservation,
  MemoryStatus,
  SessionSummary,
} from "../shared/memory.ts";
import { APP_NAME } from "../src/lib/app.ts";
import type { McpEntry } from "./mcpConfig.ts";

type Json = Record<string, unknown>;

async function readJson(path: string): Promise<Json | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

const dataDir = () =>
  process.env.CLAUDE_MEM_DATA_DIR ?? join(homedir(), ".claude-mem");

// ponytail: project is the folder name; cmem uses the git root's and
// groups worktrees under their parent, so a subfolder gets its own memories.
/** The cmem project a folder's memories are kept under. */
export const projectOf = (cwd: string) => basename(cwd);

/** Whether a folder matches cmem's CLAUDE_MEM_EXCLUDED_PROJECTS globs. */
export function excluded(cwd: string, patterns: unknown, home = homedir()) {
  if (typeof patterns !== "string") return false;
  return patterns
    .split(",")
    .map((p) => p.trim().replace(/^~(?=\/|$)/, home))
    .filter(Boolean)
    .some((glob) => matchesGlob(cwd, glob) || matchesGlob(basename(cwd), glob));
}

async function health(url: string): Promise<Json | undefined> {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok ? ((await response.json()) as Json) : undefined;
  } catch {
    return undefined;
  }
}

type Worker = {
  state: MemoryStatus["state"];
  url?: string;
  /** The running worker's script; cmem's other scripts sit beside it. */
  workerPath?: string;
};

/** cmem's state for `cwd`, with the worker's URL while it runs. */
export async function findWorker(
  cwd: string | undefined,
  dir = dataDir(),
): Promise<Worker> {
  const settings = await readJson(join(dir, "settings.json"));
  if (!settings) return { state: "not-installed" };
  if (cwd && excluded(cwd, settings.CLAUDE_MEM_EXCLUDED_PROJECTS)) {
    return { state: "excluded" };
  }
  const worker = await readJson(join(dir, "worker.pid"));
  if (typeof worker?.port !== "number") return { state: "stopped" };
  const host = settings.CLAUDE_MEM_WORKER_HOST ?? "127.0.0.1";
  const url = `http://${host}:${worker.port}`;
  const status = await health(url);
  if (!status) return { state: "stopped" };
  return {
    state: "running",
    url,
    ...(typeof status.workerPath === "string" && {
      workerPath: status.workerPath,
    }),
  };
}

/** Tools the agent sees directly; the rest stay behind the adapter's `mcp` tool. */
const DIRECT_TOOLS = ["search", "timeline", "get_observations"];

// ponytail: direct tools come from the adapter's tool cache, so a session's
// first connection only fills it; they appear from the next session on.
/**
 * cmem's own search server, from beside the running worker (so any agent's
 * install works), connected when the session starts. Empty when cmem is off.
 */
export async function cmemServer(): Promise<Record<string, McpEntry>> {
  if (!(await memoryEnabled())) return {};
  const { workerPath } = await findWorker(undefined);
  if (!workerPath) return {};
  const script = join(dirname(workerPath), "mcp-server.cjs");
  if (!existsSync(script)) return {};
  return {
    cmem: {
      command: process.execPath,
      args: [script],
      lifecycle: "eager",
      directTools: DIRECT_TOOLS,
      // Plans and to-dos belong in tasks; session_start_context returns the unfiltered work state.
      excludeTools: [
        "work_state_write",
        "work_state_read",
        "session_start_context",
      ],
    },
  };
}

/** Whether the app's settings leave cmem on (`[memory] cmem`). */
export async function memoryEnabled(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    return (settings.memory as Json | undefined)?.cmem !== false;
  } catch {
    return true;
  }
}

/** The project's latest observations from the worker; empty if it can't say. */
export async function recentObservations(
  url: string,
  project: string,
  limit = 8,
): Promise<MemoryObservation[]> {
  try {
    const query = `project=${encodeURIComponent(project)}&limit=${limit}`;
    const response = await fetch(`${url}/api/observations?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    const { items } = (await response.json()) as { items: Json[] };
    return items.map((o) => ({
      id: o.id as number,
      type: o.type as string,
      title: (o.title as string | null) ?? "Untitled",
      ...(typeof o.subtitle === "string" && { subtitle: o.subtitle }),
      createdAt: o.created_at_epoch as number,
      platform: o.platform_source as string,
    }));
  } catch {
    return [];
  }
}

/** What the Memory settings show: cmem's state and the folder's memories. */
export async function memoryStatus(cwd?: string): Promise<MemoryStatus> {
  const { state, url } = await findWorker(cwd);
  if (!url) return { state, observations: [] };
  return {
    state,
    viewerUrl: url,
    observations: cwd ? await recentObservations(url, projectOf(cwd)) : [],
  };
}

const SUMMARIES = 100;

const text = (v: unknown) => (typeof v === "string" && v.trim()) || undefined;

// ponytail: looks through the project's latest summaries only; a much older
// conversation shows none. Ask the worker by session once it can.
/**
 * cmem's latest summary of conversation `session` in `cwd`, when cmem is on,
 * running and recorded it.
 */
export async function sessionSummary(
  cwd: string,
  session: string,
  dir = dataDir(),
): Promise<SessionSummary | undefined> {
  if (!(await memoryEnabled())) return undefined;
  const { url } = await findWorker(cwd, dir);
  if (!url) return undefined;
  try {
    const query = `project=${encodeURIComponent(projectOf(cwd))}&limit=${SUMMARIES}`;
    const response = await fetch(`${url}/api/summaries?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    const { items } = (await response.json()) as { items: Json[] };
    const found = items.find((s) => s.session_id === session);
    return (
      found && {
        request: text(found.request),
        completed: text(found.completed),
        learned: text(found.learned),
        nextSteps: text(found.next_steps),
      }
    );
  } catch {
    return undefined;
  }
}
