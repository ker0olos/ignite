/**
 * Demo mode (`npm run demo`): the app opens demo/tempo and demo/pantry, and a
 * demo host (demoHost.ts) stands in for the sidecar, so everything shown is
 * scripted: providers, models, conversations, search, git. Tempo has three
 * conversations at once: one delivered through git, one waiting on its
 * commit's review, one still working; Pantry's waits on the agent's
 * questions. Their tasks (demoTasks.ts) follow those conversations, with a
 * few more to do and done. Whatever is typed into the composer comes out as
 * DEMO_PROMPT.
 */
import type { AgentStatus } from "../../shared/hostProtocol";
import { demoConversations } from "./demoConversations";
import { createDemoHost } from "./demoHost";
import { dirname } from "./paths";
import { openPiHost, type HostClient } from "./piHost";

/** The demo project's folder while in demo mode, otherwise null. */
export const DEMO_FOLDER: string | null = __DEMO_FOLDER__;

/** The projects demo mode opens, the shown one last. */
export const demoProjects = (demo: string) => [`${dirname(demo)}/pantry`, demo];

/** The task the Tasks view shows open, in demo mode only. */
export const DEMO_OPEN_TASK = DEMO_FOLDER ? "task-reload" : null;

/** What the composer types in demo mode, a letter per key pressed. */
export const DEMO_PROMPT = "Add a short summary of this project to the README.";

/** The composer's text after a change: in demo mode, as much of DEMO_PROMPT as was typed. */
export const typedText = (value: string, demo = DEMO_FOLDER) =>
  demo ? DEMO_PROMPT.slice(0, value.length) : value;

/** Starts the app's host: the sidecar, or in demo mode the demo host. */
export const hostOpener = (demo = DEMO_FOLDER): (() => Promise<HostClient>) =>
  demo ? async () => createDemoHost(demo) : openPiHost;

/** This run's host opener (stable, as useProviders needs). */
export const OPEN_HOST = hostOpener();

/** The session as the workspace shows it: with the host's error when the sidecar didn't start, since the session then never opens. */
export function shownSession<S extends { error: string | null }>(
  session: S,
  hostError: string | null,
): S {
  return { ...session, error: session.error ?? hostError };
}

/** A folder's listed conversations; in demo mode the demo's open ones. */
export function shownRows(
  rows: (cwd: string) => AgentStatus[],
  demo: string | null = DEMO_FOLDER,
): (cwd: string) => AgentStatus[] {
  if (!demo) return rows;
  const all = demoConversations(demo)
    .filter((c) => c.open)
    .map((c) => ({
      cwd: c.cwd,
      session: c.id,
      title: c.title,
      running: !!c.running,
      waiting: !!c.approvals?.length,
    }));
  return (cwd) => all.filter((a) => a.cwd === cwd);
}
