/**
 * Pantry's second conversation: the agent leaves the dev server running in
 * the background and hands the checks to two subagents, one done, one working.
 */
import { BASH_STOP_TOOL, type AgentMessage } from "../../shared/agentTypes";
import type { BackgroundOutput, ChildRuns } from "../../shared/agentStatus";
import { SUBAGENT_TOOL, type SubagentDetails } from "../../shared/subagents";
import type { DemoConversation } from "./demoConversations";
import { assistant, call, result, T } from "./demoTranscript";

const DEV_PID = 48213;
const LOG = `/tmp/ignite-background/${DEV_PID}.log`;
const HELPER = { model: "claude-haiku-4-5", effort: "low" };

const serve = call("p1", "bash", { command: "npm run dev", background: true });
const searchAgent = call("p2", SUBAGENT_TOOL, {
  ...HELPER,
  message:
    "The Pantry API runs on http://localhost:3000. Try GET /recipes with odd `with` lists (empty, spaces, repeats, unknown items) and report anything wrong.",
});
/** The subagent still checking saving recipes. */
const SAVE_AGENT = call("p3", SUBAGENT_TOOL, {
  ...HELPER,
  message:
    "The Pantry API runs on http://localhost:3000. POST /recipes with bad bodies (not JSON, missing fields, wrong types) and report how it answers.",
});

const user = (content: string): AgentMessage => ({
  role: "user",
  content,
  timestamp: T,
});

const curlEmpty = call("q1", "bash", {
  command: "curl -s 'localhost:3000/recipes?with='",
});
const curlSpaces = call("q2", "bash", {
  command: "curl -s 'localhost:3000/recipes?with=egg,%20flour'",
});

const FOUND =
  "An empty `with=` returns no recipes instead of all of them: it splits into one empty name. Spaces after commas aren't trimmed either, so ` flour` never matches.";

const searchDetails: SubagentDetails = {
  id: "agent-1",
  ...HELPER,
  running: false,
  messages: [
    user(String(searchAgent.arguments.message)),
    assistant([curlEmpty, curlSpaces]),
    result(curlEmpty, "[]"),
    result(curlSpaces, '[{"id":2,"title":"Pancakes",…}]'),
    assistant([{ type: "text", text: FOUND }], true),
  ],
};

const postBad = call("q3", "bash", {
  command:
    "curl -s -X POST localhost:3000/recipes -d 'not json'; echo; tail -3 " +
    LOG,
});

/** What the working subagent has done so far, as its live updates carry it. */
const SAVE_PROGRESS: SubagentDetails = {
  id: "agent-2",
  ...HELPER,
  running: true,
  messages: [
    user(String(SAVE_AGENT.arguments.message)),
    assistant([postBad]),
    result(
      postBad,
      "curl: (52) Empty reply from server\n\nSyntaxError: Unexpected token 'o', \"not json\" is not valid JSON\n    at JSON.parse (<anonymous>)\nRestarting 'src/server.ts'",
    ),
    assistant([
      {
        type: "text",
        text: "A body that isn't JSON crashes the server. Trying missing fields next.",
      },
    ]),
  ],
};

/** The conversation, oldest first: the dev server runs, one check still going. */
const CHECK_MESSAGES: AgentMessage[] = [
  user("Check the recipes API for edge cases before I ship it."),
  assistant([
    {
      type: "text",
      text: "I'll start the dev server and leave it running while I test against it.",
    },
    serve,
  ]),
  result(
    serve,
    `> pantry@0.4.0 dev\n> node --watch src/server.ts\n\nStill running in the background as pid ${DEV_PID}. Its output goes to ${LOG}; read it with tail, and end it with ${BASH_STOP_TOOL}.`,
    { background: { pid: DEV_PID, log: LOG } },
  ),
  assistant([
    {
      type: "text",
      text: "Searching and saving are separate, so two helpers can check them at once.",
    },
    searchAgent,
    SAVE_AGENT,
  ]),
  result(searchAgent, `agent-1 replied:\n\n${FOUND}`, searchDetails),
];

/** What the sidebar lists under the conversation. */
const CHECK_CHILDREN: ChildRuns = {
  subagents: [
    { id: "agent-1", model: HELPER.model, running: false },
    { id: "agent-2", model: HELPER.model, running: true },
  ],
  background: [{ pid: DEV_PID, command: "npm run dev", running: true }],
};

/** The dev server's log so far, as its tab shows it. */
export const DEV_OUTPUT: BackgroundOutput = {
  command: "npm run dev",
  running: true,
  output: [
    "> pantry@0.4.0 dev",
    "> node --watch src/server.ts",
    "",
    "SyntaxError: Unexpected token 'o', \"not json\" is not valid JSON",
    "    at JSON.parse (<anonymous>)",
    "    at Server.<anonymous> (src/server.ts:18:30)",
    "Restarting 'src/server.ts'",
    "",
  ].join("\n"),
  truncated: false,
};

/** The conversation as the demo lists it, in `pantry`. */
export const checkConversation = (
  pantry: string,
  now: number,
): DemoConversation => ({
  id: "pantry-check",
  cwd: pantry,
  title: "Check the recipes API for edge cases",
  modified: now - 4 * 60_000,
  messages: CHECK_MESSAGES,
  open: true,
  running: true,
  working: SAVE_AGENT,
  progress: SAVE_PROGRESS,
  children: CHECK_CHILDREN,
  details: { model: "claude-opus-5-5", files: [], toolCalls: 6, cost: 0.15 },
});
