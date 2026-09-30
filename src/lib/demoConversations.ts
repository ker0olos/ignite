/**
 * Every conversation in the demo: the open ones in the sidebar, and older
 * saved ones that only the command center finds, each with its details.
 */
import type { AgentMessage, ToolCall } from "../../shared/agentTypes";
import type { SessionDetails } from "../../shared/conversations";
import type { ApprovalRequest } from "../../shared/hostProtocol";
import { darkModeMessages, DARK_MODE_DIFFS } from "./demoDarkMode";
import { DEMO_QUESTION_MESSAGES, DEMO_QUESTIONS } from "./demoQuestions";
import { DEMO_TASK_ADD, DEMO_TASK_ADD_MESSAGES } from "./demoTaskAdd";
import {
  RELOAD_EDIT,
  RELOAD_MESSAGES,
  TESTS_DIFFS,
  TESTS_MESSAGES,
  TESTS_PR,
  testsReview,
} from "./demoTempoWork";
import { assistant } from "./demoTranscript";
import { dirname } from "./paths";

export type DemoConversation = {
  id: string;
  cwd: string;
  title: string;
  modified: number;
  messages: AgentMessage[];
  details: SessionDetails;
  /** Listed in the sidebar; else only saved. */
  open?: boolean;
  running?: boolean;
  approvals?: ApprovalRequest[];
  /** A tool call still running, which history alone can't show. */
  working?: ToolCall;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// A saved conversation: its request and the agent's last word.
const saved = (ask: string, reply: string): AgentMessage[] => [
  { role: "user", content: ask, timestamp: 0 },
  assistant([{ type: "text", text: reply }], true),
];

/** What `git_diff` shows for each file the demo's commits change. */
export const DEMO_GIT_DIFFS: Record<string, string> = {
  ...DARK_MODE_DIFFS,
  ...TESTS_DIFFS,
};

const claude = { model: "claude-opus-5-5" };

/** The demo's conversations, with `tempo` the demo folder and pantry beside it. */
export function demoConversations(
  tempo: string,
  now = Date.now(),
): DemoConversation[] {
  const pantry = `${dirname(tempo)}/pantry`;
  return [
    ...openConversations(tempo, pantry, now),
    ...savedConversations(tempo, pantry, now),
  ];
}

// The sidebar's, working, waiting or done.
function openConversations(
  tempo: string,
  pantry: string,
  now: number,
): DemoConversation[] {
  return [
    {
      id: "tempo",
      cwd: tempo,
      title: "Add a dark mode to Tempo",
      modified: now - 20 * 60_000,
      messages: darkModeMessages(tempo),
      open: true,
      details: {
        ...claude,
        files: Object.keys(DARK_MODE_DIFFS),
        toolCalls: 13,
        cost: 0.84,
        branch: "feat/dark-mode",
        summary: {
          completed:
            "Added a dark theme that follows the system by default, with a Theme picker in Settings. Committed on feat/dark-mode and opened pull request #12.",
          nextSteps: "Merge #12 once reviewed.",
          learned:
            "Tempo's colors were hard-coded in styles.css; they are CSS variables now, so a theme only swaps the variables.",
        },
      },
    },
    {
      id: "tempo-tests",
      cwd: tempo,
      title: "Write tests for loading and saving settings",
      modified: now - 5 * 60_000,
      messages: TESTS_MESSAGES,
      open: true,
      running: true,
      approvals: [{ toolCallId: TESTS_PR.id, review: testsReview(tempo) }],
      details: {
        ...claude,
        files: Object.keys(TESTS_DIFFS),
        toolCalls: 7,
        cost: 0.24,
        branch: "test/settings",
      },
    },
    {
      id: "tempo-reload",
      cwd: tempo,
      title: "Keep the timer going across a page reload",
      modified: now - 60_000,
      messages: RELOAD_MESSAGES,
      open: true,
      running: true,
      working: RELOAD_EDIT,
      details: { ...claude, files: [], toolCalls: 3, cost: 0.09 },
    },
    {
      id: "tempo-bugs",
      cwd: tempo,
      title: "List the open bugs assigned to me",
      modified: now - 3 * 60_000,
      messages: DEMO_TASK_ADD_MESSAGES,
      open: true,
      running: true,
      approvals: [
        { toolCallId: DEMO_TASK_ADD.id, reason: "Add these to your tasks?" },
      ],
      details: { ...claude, files: [], toolCalls: 2, cost: 0.05 },
    },
    {
      id: "pantry",
      cwd: pantry,
      title: "Let people sign in to Pantry",
      modified: now - 2 * 60_000,
      messages: DEMO_QUESTION_MESSAGES,
      open: true,
      running: true,
      approvals: [{ toolCallId: DEMO_QUESTIONS.id }],
      details: { ...claude, files: [], toolCalls: 3, cost: 0.12 },
    },
  ];
}

// Closed ones, which only the command center finds.
function savedConversations(
  tempo: string,
  pantry: string,
  now: number,
): DemoConversation[] {
  return [
    {
      id: "tempo-ci",
      cwd: tempo,
      title: "Run the tests on every pull request",
      modified: now - 3 * DAY,
      messages: saved(
        "Run the tests on every pull request.",
        "Added a GitHub Actions workflow that installs, type-checks and runs the tests on each pull request, and merged it as #9.",
      ),
      details: {
        model: "claude-sonnet-5",
        files: [".github/workflows/test.yml", "package.json"],
        toolCalls: 9,
        cost: 0.18,
        branch: "ci/tests",
        summary: {
          completed:
            "GitHub Actions runs npm ci, tsc and vitest on every pull request to main. Merged as #9.",
          learned:
            "Vitest needs no browser for Tempo's tests, so the workflow runs on ubuntu-latest without extra setup.",
        },
      },
    },
    {
      id: "tempo-skip",
      cwd: tempo,
      title: "The break timer skips a second when it starts",
      modified: now - 6 * DAY,
      messages: saved(
        "The break timer skips a second when it starts. Can you find out why?",
        "The countdown ticked once before showing the first value, so 05:00 never appeared. It now shows the full length first, with a test for it.",
      ),
      details: {
        ...claude,
        files: ["src/timer.ts", "tests/timer.test.ts"],
        toolCalls: 7,
        cost: 0.31,
        branch: "fix/break-start",
        summary: {
          completed:
            "Fixed an off-by-one in startTimer: a new session now shows its full length before counting down.",
          learned:
            "setInterval's first tick comes a full second after it starts, so the first value has to be drawn up front.",
        },
      },
    },
    {
      id: "tempo-streak",
      cwd: tempo,
      title: "Show how many days in a row I've practised",
      modified: now - 3 * HOUR,
      messages: saved(
        "Show how many days in a row I've practised.",
        "You declined the pull request, so I've stopped here. Tell me what to change and I'll pick it up.",
      ),
      details: {
        ...claude,
        files: ["src/history.ts", "tests/history.test.ts"],
        toolCalls: 11,
        cost: 0.27,
        branch: "feat/streak",
      },
    },
    {
      id: "pantry-import",
      cwd: pantry,
      title: "Import a recipe from a web page",
      modified: now - 2 * DAY,
      messages: saved(
        "Let me paste a recipe's URL and import it.",
        "Pasting a URL now reads the page's schema.org Recipe data and fills in the title, ingredients and steps, and asks when a page has none.",
      ),
      details: {
        ...claude,
        files: ["src/import.ts", "src/server.ts", "tests/import.test.ts"],
        toolCalls: 16,
        cost: 1.12,
        branch: "feat/url-import",
        summary: {
          completed:
            "Recipes import from a URL using the page's JSON-LD Recipe data. Pull request #4 is open.",
          nextSteps: "Handle pages that list ingredients as one block of text.",
          learned:
            "Most recipe sites embed schema.org Recipe JSON-LD, which is sturdier to read than their HTML.",
        },
      },
    },
  ];
}
