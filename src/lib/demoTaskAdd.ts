/**
 * A Tempo conversation that turns the user's open bugs into tasks: the agent
 * lists them from the GitHub MCP server as a table, then waits on task_add.
 */
import type { AgentMessage } from "../../shared/agentTypes";
import { TASK_ADD_TOOL } from "../../shared/tasks";
import { assistant, call, result, T } from "./demoTranscript";

const search = call("b1", "mcp__github", {
  tool: "search_issues",
  args: { q: "repo:ker0olos/tempo is:open label:bug assignee:@me" },
});

const ISSUES = `| # | Bug | Opened | Comments |
| --- | --- | --- | --- |
| [#21](https://github.com/ker0olos/tempo/issues/21) | Sound plays twice when a break ends | 2 days ago | 3 |
| [#18](https://github.com/ker0olos/tempo/issues/18) | Paused timer resumes after the laptop wakes | 5 days ago | 1 |
| [#16](https://github.com/ker0olos/tempo/issues/16) | Session length resets to 25 on every launch | 1 week ago | 0 |
| [#14](https://github.com/ker0olos/tempo/issues/14) | Tab title shows NaN:NaN before the first tick | 2 weeks ago | 2 |`;

/** The call left waiting for the user. */
export const DEMO_TASK_ADD = call("b2", TASK_ADD_TOOL, {
  tasks: [
    {
      title: "Sound plays twice when a break ends",
      notes:
        "https://github.com/ker0olos/tempo/issues/21\nThe end chime fires from both the countdown and the break-ended handler.",
      subtasks: ["Reproduce with a 1 minute break", "Play the chime once"],
    },
    {
      title: "Paused timer resumes after the laptop wakes",
      notes: "https://github.com/ker0olos/tempo/issues/18",
    },
    {
      title: "Tab title shows NaN:NaN before the first tick",
      notes: "https://github.com/ker0olos/tempo/issues/14",
    },
  ],
});

/** The conversation, oldest first. */
export const DEMO_TASK_ADD_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content: "List the open bugs assigned to me.",
    timestamp: T,
  },
  assistant([search]),
  result(
    search,
    '{"total_count":4,"items":[{"number":21,"title":"Sound plays twice when a break ends"},…]}',
  ),
  assistant(
    [{ type: "text", text: `You have 4 open bugs on Tempo:\n\n${ISSUES}` }],
    true,
  ),
  {
    role: "user",
    content: "Add 21, 18 and 14 as tasks.",
    timestamp: T,
  },
  assistant([
    { type: "text", text: "Here they are, with the issue linked in each." },
    DEMO_TASK_ADD,
  ]),
];
