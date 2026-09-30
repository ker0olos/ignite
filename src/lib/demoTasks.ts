/**
 * The demo's tasks. Started ones point at the demo's conversations, whose
 * state gives theirs: the tests conversation waits on its commit's review,
 * the reload one is working, dark mode is delivered in #12, and two saved
 * ones are done. Two more wait to be started.
 */
import type { Subtask, Task } from "../../shared/tasks";
import {
  CHART_SKETCH,
  DARK_MOCKUP,
  LIGHT_MOCKUP,
  RELOAD_BUG,
} from "./demoTaskImages";
import { dirname } from "./paths";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PR = "https://github.com/tempo-app/tempo/pull";

const subtasks = (done: number, titles: string[], working = -1): Subtask[] =>
  titles.map((title, i) => ({
    title,
    status: i < done ? "done" : i === working ? "working" : "todo",
  }));

const base = { images: [], created: 0 };

/** Each demo folder's tasks: Tempo's, and Pantry's beside it. */
export function demoTasks(
  tempo: string,
  now = Date.now(),
): Record<string, Task[]> {
  return {
    [tempo]: tempoTasks(now),
    [`${dirname(tempo)}/pantry`]: [
      {
        ...base,
        id: "task-signin",
        title: "Let people sign in to Pantry",
        notes: "Recipes stay private to whoever saved them.",
        subtasks: [],
        session: "pantry",
        updated: now - 2 * MINUTE,
      },
    ],
  };
}

function tempoTasks(now: number): Task[] {
  return [
    {
      ...base,
      id: "task-tests",
      title: "Write tests for loading and saving settings",
      notes:
        "Cover a missing file, a corrupt one, and a file from an older version. No mocking the file system; use a temp folder.",
      subtasks: subtasks(
        3,
        [
          "Test a missing settings file",
          "Test a corrupt file",
          "Test settings from v1",
          "Commit and open the pull request",
        ],
        3,
      ),
      session: "tempo-tests",
      planned: true,
      step: "Running git commit -m test(settings): cover load and save",
      updated: now - 5 * MINUTE,
    },
    {
      ...base,
      id: "task-reload",
      title: "Keep the timer going across a page reload",
      notes:
        "Reloading the page resets a running timer to the start (screenshot). It should pick up where it was, even after closing the tab.",
      images: [RELOAD_BUG],
      subtasks: subtasks(
        1,
        [
          "Save the timer's end time when it starts",
          "Restore a running timer on load",
          "Test a reload mid-session",
        ],
        1,
      ),
      session: "tempo-reload",
      planned: true,
      step: "Editing src/timer.ts",
      updated: now - MINUTE,
    },
    {
      ...base,
      id: "task-dark",
      title: "Add a dark mode to Tempo",
      notes:
        "Follow the system by default, with a Theme picker in Settings. Match the mockups; the ring keeps the accent color.",
      images: [DARK_MOCKUP, LIGHT_MOCKUP],
      subtasks: subtasks(4, [
        "Move colors into CSS variables",
        "Add the dark palette",
        "Theme picker in Settings",
        "Screenshots for the pull request",
      ]),
      session: "tempo",
      planned: true,
      pr: `${PR}/12`,
      shown: [{ ...DARK_MOCKUP, name: "tempo-dark.png" }],
      updated: now - 20 * MINUTE,
    },
    {
      ...base,
      id: "task-chart",
      title: "Show a weekly practice chart",
      notes:
        "A bar per day with minutes practised, like the sketch. Highlight the best day. It belongs on the History screen.",
      images: [CHART_SKETCH],
      subtasks: subtasks(0, [
        "Sum each day's sessions",
        "Draw the bars",
        "Highlight the best day",
      ]),
      updated: now - 2 * HOUR,
    },
    {
      ...base,
      id: "task-csv",
      title: "Export practice history as CSV",
      notes: "One row per session: date, length, and whether it was a break.",
      subtasks: [],
      updated: now - DAY,
    },
    {
      ...base,
      id: "task-ci",
      title: "Run the tests on every pull request",
      notes: "",
      subtasks: subtasks(2, ["Add the workflow", "Check it on a pull request"]),
      session: "tempo-ci",
      planned: true,
      pr: `${PR}/9`,
      done: true,
      updated: now - 3 * DAY,
    },
    {
      ...base,
      id: "task-skip",
      title: "The break timer skips a second when it starts",
      notes: "",
      subtasks: subtasks(2, ["Find why", "Fix it with a test"]),
      session: "tempo-skip",
      planned: true,
      pr: `${PR}/7`,
      done: true,
      updated: now - 6 * DAY,
    },
  ];
}

/** The demo host's answers about tasks, kept in memory; starting one runs nothing. */
export function tasksAnswers(byFolder: Record<string, Task[]>) {
  const list = (cwd: string) => byFolder[cwd] ?? [];
  const put = (cwd: string, tasks: Task[]) => (byFolder[cwd] = tasks);
  return {
    tasks_list: (r: { cwd: string }) => list(r.cwd),
    task_save: ({ cwd, task }: { cwd: string; task: Task }) =>
      put(
        cwd,
        list(cwd).some((t) => t.id === task.id)
          ? list(cwd).map((t) => (t.id === task.id ? task : t))
          : [...list(cwd), task],
      ),
    task_delete: ({ cwd, taskId }: { cwd: string; taskId: string }) =>
      put(
        cwd,
        list(cwd).filter((t) => t.id !== taskId),
      ),
    task_start: (r: { cwd: string }) => list(r.cwd),
  };
}
