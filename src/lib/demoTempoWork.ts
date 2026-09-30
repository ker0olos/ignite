/**
 * Tempo's other open conversations: one waits on the user to review its
 * pull request, the other is still working. Both run beside the dark mode one.
 */
import SETTINGS_TEST from "../../demo/tempo/tests/settings.test.ts?raw";
import type { AgentMessage } from "../../shared/agentTypes";
import { GH_TOOL, GIT_TOOL, type GitReview } from "../../shared/git";
import { addedFile, commitReview } from "./demoGit";
import { assistant, call, result, T } from "./demoTranscript";

const TEST_PATH = "tests/settings.test.ts";
const TEST_MESSAGE = "test: loading, saving and applying settings";
const TEST_BODY = "Covers a missing file, a corrupt one and one from v1.";
const TEST_BRANCH = "test/settings";
const TEST_HASH = "9b3f0d1";

/** What the tests conversation's commit adds. */
export const TESTS_DIFFS = { [TEST_PATH]: addedFile(SETTINGS_TEST) };

const readSettings = call("t1", "read", { path: "src/settings.ts" });
const writeTest = call("t2", "write", {
  path: TEST_PATH,
  content: SETTINGS_TEST,
});
const runTests = call("t3", "bash", { command: "npm test" });
const branch = call("t4", GIT_TOOL, { args: ["switch", "-c", TEST_BRANCH] });
const commit = call("t5", GIT_TOOL, {
  args: ["commit", "-am", TEST_MESSAGE],
});
const push = call("t6", GIT_TOOL, {
  args: ["push", "-u", "origin", TEST_BRANCH],
});
/** The pull request left waiting for the user's review. */
export const TESTS_PR = call("t7", GH_TOOL, {
  args: ["pr", "create", "--title", TEST_MESSAGE, "--body", TEST_BODY],
});

/** The review the waiting pull request shows, in `tempo`. */
export function testsReview(tempo: string): GitReview {
  const committed = commitReview(tempo, TESTS_DIFFS, TEST_MESSAGE);
  return {
    ...committed,
    kind: "pr",
    range: `gh:you/tempo:main...${TEST_BRANCH}`,
    message: undefined,
    commits: [{ hash: TEST_HASH, subject: TEST_MESSAGE }],
    pr: {
      repo: "you/tempo",
      base: "main",
      head: TEST_BRANCH,
      title: TEST_MESSAGE,
      body: TEST_BODY,
      draft: false,
    },
  };
}

/** The tests conversation, oldest first: its pull request waits for review. */
export const TESTS_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content: "Write tests for loading and saving settings.",
    timestamp: T,
  },
  assistant([readSettings]),
  result(readSettings, 'import { applyTheme, type Theme } from "./theme";\n…'),
  assistant([
    {
      type: "text",
      text: "Settings load from localStorage over the defaults, and applying them saves them and sets the durations and theme. I'll test both, with storage stubbed.",
    },
    writeTest,
  ]),
  result(writeTest, `Wrote ${TEST_PATH}`),
  assistant([runTests]),
  result(
    runTests,
    " ✓ tests/settings.test.ts (4 tests) 4ms\n ✓ tests/timer.test.ts (2 tests) 2ms\n\n Test Files  2 passed (2)\n      Tests  6 passed (6)",
  ),
  assistant([
    {
      type: "text",
      text: "All six pass. I'll put them on a branch and open a pull request.",
    },
    branch,
    commit,
    push,
  ]),
  result(branch, `Switched to a new branch '${TEST_BRANCH}'`),
  result(commit, `[${TEST_BRANCH} ${TEST_HASH}] ${TEST_MESSAGE}`),
  result(
    push,
    `To github.com:you/tempo.git\n * [new branch]      ${TEST_BRANCH} -> ${TEST_BRANCH}`,
  ),
  assistant([TESTS_PR]),
];

const readTimer = call("s1", "read", { path: "src/timer.ts" });
const readMain = call("s2", "read", { path: "src/main.ts" });
/** The reload conversation's edit, still running. */
export const RELOAD_EDIT = call("s3", "edit", { path: "src/timer.ts" });

/** The reload conversation, oldest first: its edit is still running. */
export const RELOAD_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content:
      "The timer starts over when I reload the page. Keep it going across reloads.",
    timestamp: T,
  },
  assistant([readTimer, readMain]),
  result(readTimer, "let focus = 25 * 60;\nlet rest = 5 * 60;\n…"),
  result(
    readMain,
    'import { applySettings, loadSettings } from "./settings";\n…',
  ),
  assistant([
    {
      type: "text",
      text: "The countdown only lives in memory. I'll save when the current session ends, so a reload picks up where it left off.",
    },
    RELOAD_EDIT,
  ]),
];
