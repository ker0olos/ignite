/** Which Chrome tabs a task's conversation may use: only the ones it opened, named by id. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { APP_NAME } from "../src/lib/app.ts";
import { autonomous } from "../shared/tasks.ts";
import { askTask } from "./taskExtension.ts";

export const NEEDS_TAB =
  "In a task, name the tab by its id: open one with chrome_navigate and new_tab: true, then pass the id it gives.";

export const NO_USER_IN_TASK =
  "A task can't use the user's Chrome. Leave the step that needs their login for the user.";

export const NO_BROWSER_CALLS =
  "In a task, browser-wide calls are refused, since they reach other tasks' tabs. Pass one of this task's tabs instead.";

export const NO_OWN_BROWSER_CALLS =
  "Browser-wide calls run only in the user's Chrome (user_chrome: true), since the app's holds tasks' tabs. Pass a tab instead.";

/** The tab a task's call may use: one it opened, named by id; throws otherwise. */
export function taskTab(
  hint: string | undefined,
  mine: ReadonlySet<string>,
): string {
  if (!hint) throw new Error(NEEDS_TAB);
  if (!mine.has(hint)) {
    throw new Error(`Tab ${hint} isn't one this task opened. ${NEEDS_TAB}`);
  }
  return hint;
}

/**
 * Where a session's chrome calls go: the app's own Chrome, or the user's when
 * asked. A task never uses the user's, and only tabs it opened (`mine`), each named by id.
 */
export type Scope = {
  mine: Set<string>;
  /** Every task's tabs, which other conversations never pick or list. */
  claimed: ReadonlySet<string>;
  task(): Promise<boolean>;
  /** Makes a tab this task's. */
  claim(id: string): void;
  /** Whether chrome_tabs lists tab `id`: a task's own tabs, or everyone else's none of the tasks'. */
  shows(task: boolean, id: string): boolean;
  at(
    hint?: string,
    user?: boolean,
  ): Promise<{ user: boolean; tab?: string; skip?: ReadonlySet<string> }>;
};

// Shared by every session (extensions load afresh per session).
const CLAIMED = Symbol.for(`${APP_NAME}.chrome.taskTabs`);
const shared = globalThis as { [key: symbol]: Set<string> | undefined };

/** A session's scope, asking the host each call whether it's a task's. */
export function scopeOf(pi: Pick<ExtensionAPI, "events">): Scope {
  // ponytail: kept per loaded session, so a reload forgets the task's tabs and it opens new ones.
  const mine = new Set<string>();
  const claimed = (shared[CLAIMED] ??= new Set());
  const task = async () => autonomous(await askTask(pi, "get"));
  return {
    mine,
    claimed,
    task,
    claim: (id) => {
      mine.add(id);
      claimed.add(id);
    },
    shows: (isTask, id) => (isTask ? mine.has(id) : !claimed.has(id)),
    at: async (hint, user = false) => {
      if (!(await task())) return { user, tab: hint, skip: claimed };
      if (user) throw new Error(NO_USER_IN_TASK);
      return { user: false, tab: taskTab(hint, mine) };
    },
  };
}
