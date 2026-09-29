/**
 * The dark mode conversation, delivered through git: the agent commits
 * (reviewed), pushes its branch and opens a pull request.
 */
import type { AgentMessage } from "../../shared/agentTypes";
import { GH_TOOL, GIT_TOOL, type GitReview } from "../../shared/git";
import { addedFile, commitReview, unifiedDiff } from "./demoGit";
import {
  assistant,
  call,
  DEMO_DIFFS,
  DEMO_WORK,
  result,
  THEME,
} from "./demoTranscript";

const BRANCH = "feat/dark-mode";
const MESSAGE = "feat: dark mode that follows the system";
const HASH = "4e1c2a9";
const PR = {
  repo: "you/tempo",
  base: "main",
  head: BRANCH,
  title: "Dark mode that follows the system",
  body: "Adds a dark theme, picked in Settings, that follows macOS by default.",
  draft: false,
};

/** What the dark mode commit changes, per file, as unified diffs. */
export const DARK_MODE_DIFFS: Record<string, string> = {
  "src/theme.ts": addedFile(THEME),
  ...Object.fromEntries(
    Object.entries(DEMO_DIFFS).map(([path, diff]) => [path, unifiedDiff(diff)]),
  ),
};

const branch = call("g1", GIT_TOOL, { args: ["switch", "-c", BRANCH] });
const add = call("g2", GIT_TOOL, { args: ["add", "-A"] });
const commit = call("g3", GIT_TOOL, { args: ["commit", "-m", MESSAGE] });
const push = call("g4", GIT_TOOL, { args: ["push", "-u", "origin", BRANCH] });
const openPr = call("g5", GH_TOOL, {
  args: ["pr", "create", "--title", PR.title, "--body", PR.body],
});

/** The dark mode conversation in `tempo`, oldest first. */
export function darkModeMessages(tempo: string): AgentMessage[] {
  const committed = commitReview(tempo, DARK_MODE_DIFFS, MESSAGE);
  const pushed: GitReview = {
    ...committed,
    kind: "push",
    range: `${HASH}^!`,
    message: undefined,
    commits: [{ hash: HASH, subject: MESSAGE }],
  };
  const pr: GitReview = {
    ...pushed,
    kind: "pr",
    range: `gh:${PR.repo}:${PR.base}...${PR.head}`,
    pr: PR,
  };
  return [
    ...DEMO_WORK,
    assistant([
      {
        type: "text",
        text: "Tests pass. I'll put this on a branch and open a pull request.",
      },
      branch,
      add,
      commit,
    ]),
    result(branch, `Switched to a new branch '${BRANCH}'`),
    result(add, ""),
    result(commit, `[${BRANCH} ${HASH}] ${MESSAGE}`, committed),
    assistant([push, openPr]),
    result(
      push,
      `To github.com:${PR.repo}.git\n * [new branch]      ${BRANCH} -> ${BRANCH}`,
      pushed,
    ),
    result(openPr, `https://github.com/${PR.repo}/pull/12`, pr),
    assistant(
      [
        {
          type: "text",
          text: [
            "Dark mode is in, and up for review in **#12**.",
            "",
            "- **Follows the system** by default, and switches live when macOS changes appearance.",
            "- **Settings → Theme** offers Match system, Light and Dark.",
            "- The choice is **saved** with the other settings, so it sticks between visits.",
            "",
            "Your folder updates by itself once the pull request merges.",
          ].join("\n"),
        },
      ],
      true,
    ),
  ];
}
