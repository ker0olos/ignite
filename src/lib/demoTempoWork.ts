/**
 * Tempo's other open conversations: one waits on the user to review its
 * commit, the other is still working. Both run beside the dark mode one.
 */
import SETTINGS_TEST from "../../demo/tempo/tests/settings.test.ts?raw";
import type { AgentMessage } from "../../shared/agentTypes";
import { GIT_TOOL, type GitReview } from "../../shared/git";
import { addedFile, commitReview } from "./demoGit";
import { assistant, call, result, T } from "./demoTranscript";

const TEST_PATH = "tests/settings.test.ts";
const TEST_MESSAGE = "test: loading, saving and applying settings";

/** What the tests conversation's commit adds. */
export const TESTS_DIFFS = { [TEST_PATH]: addedFile(SETTINGS_TEST) };

const readSettings = call("t1", "read", { path: "src/settings.ts" });
const writeTest = call("t2", "write", {
  path: TEST_PATH,
  content: SETTINGS_TEST,
});
const runTests = call("t3", "bash", { command: "npm test" });
/** The commit left waiting for the user's review. */
export const TESTS_COMMIT = call("t4", GIT_TOOL, {
  args: ["commit", "-m", TEST_MESSAGE],
});

/** The tests conversation, oldest first: its commit waits for review. */
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
    { type: "text", text: "All six pass. Committing the new tests." },
    TESTS_COMMIT,
  ]),
];

/** The review the waiting commit shows, in `tempo`. */
export const testsReview = (tempo: string): GitReview =>
  commitReview(tempo, TESTS_DIFFS, TEST_MESSAGE);

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
