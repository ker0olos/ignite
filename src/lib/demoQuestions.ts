/**
 * The demo's second project, demo/pantry: the agent was asked to add sign-in
 * and waits on its questions about how, so the sidebar shows it waiting.
 */
import type { AgentMessage } from "../../shared/agentTypes";
import { ASK_TOOL } from "../../shared/questions";
import { assistant, call, result, T } from "./demoTranscript";
import { fromHistory, requestApproval, type Transcript } from "./transcript";

const readServer = call("p1", "read", { path: "src/server.ts" });
const readRecipes = call("p2", "read", { path: "src/recipes.ts" });

/** The call left waiting for the user. */
export const DEMO_QUESTIONS = call("q1", ASK_TOOL, {
  questions: [
    {
      header: "Sign-in",
      question: "How should people sign in?",
      options: [
        {
          label: "Email magic link (Recommended)",
          description:
            "No passwords to store or reset. Needs an email sender such as Resend.",
        },
        {
          label: "Email and password",
          description:
            "Familiar to everyone. You store bcrypt hashes and build password resets.",
        },
        {
          label: "GitHub OAuth",
          description:
            "One click for developers. Needs an OAuth app, and leaves out people without GitHub.",
        },
      ],
    },
    {
      header: "Sessions",
      question: "Where should sessions live?",
      options: [
        {
          label: "Signed cookie (Recommended)",
          description:
            "Nothing to store or look up. A session can't be ended before it expires.",
        },
        {
          label: "Sessions table in SQLite",
          description:
            "Sessions can be listed and ended early. One query per request.",
        },
        {
          label: "JWT in the Authorization header",
          description:
            "Suits API clients and scripts. Browsers have to keep the token themselves.",
        },
      ],
    },
    {
      header: "Scope",
      question: "What should come with it?",
      multiSelect: true,
      options: [
        {
          label: "Recipes owned by their author",
          description: "Only the author can edit or delete a recipe.",
        },
        {
          label: "Rate-limited sign-in",
          description: "Slows down guessing and email spam.",
        },
        {
          label: "Tests for the auth routes",
          description: "Sign-in, sign-out and a protected route.",
        },
      ],
    },
  ],
});

/** The pantry conversation, oldest first. */
export const DEMO_QUESTION_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content:
      "Let people sign in to Pantry, so each person keeps their own recipes.",
    timestamp: T,
  },
  assistant([
    { type: "text", text: "I'll see how requests and recipes work first." },
    readServer,
    readRecipes,
  ]),
  result(
    readServer,
    'import { createServer } from "node:http";\nimport { cookable, save } from "./recipes.ts";\n…',
  ),
  result(
    readRecipes,
    'import { db } from "./db.ts";\n\nexport type Recipe = {\n…',
  ),
  assistant([
    {
      type: "text",
      text: "There's no notion of a user yet: one plain HTTP server and a single recipes table. A few choices shape everything after this, so I'd like your call on them first.",
    },
    DEMO_QUESTIONS,
  ]),
];

/** The pantry conversation as the app shows it: running, its questions waiting. */
export function demoQuestionTranscript(): Transcript {
  return requestApproval(fromHistory(DEMO_QUESTION_MESSAGES, true), {
    toolCallId: DEMO_QUESTIONS.id,
  });
}
