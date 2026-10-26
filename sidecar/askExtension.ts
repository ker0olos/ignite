/**
 * The ask_user tool: the agent asks the user multiple-choice questions and
 * waits, over the approval channel (the app draws them in the tool row).
 * With `[conversation] ask_questions` on (the default) the agent is told to
 * bring every open decision to the user; off, the tool is dropped and it's
 * told to decide on its own. Read before each run, so a change applies to
 * the next message.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parse as parseToml } from "smol-toml";
import { Type } from "typebox";
import {
  ASK_TOOL,
  type AskDetails,
  type QuestionAnswer,
} from "../shared/questions.ts";
import { TASK_TOOL } from "../shared/tasks.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalAsk.ts";
import { nudgeStops } from "./stopNudge.ts";

export const ASKING = `## Deciding with the user
The user wants to be part of every decision. Whenever the request leaves something open (an approach, a design, a library, a data shape, names others will see, scope, a trade-off, or which of several ways to carry out a task), ask with the ${ASK_TOOL} tool before you commit, instead of choosing yourself.
- Find out facts first: read the code and run commands rather than asking what you can look up. Then ask about the choices that remain.
- Report before you ask. When you've finished work or have results, write them out in your reply first (what you did, what you found, the numbers), as briefly as the facts allow, then ask. A question never replaces that report, and its options are no place for it.
- When the results are several separate things to act on (issues, errors, review findings), first add the ones worth doing as subtasks with ${TASK_TOOL}, then ask only about the ones whose handling is genuinely open.
- One decision per question, about a specific choice. Never an open "What should I do next?", and never one "Which of these should I take on?" over a long list.
- Offer 2 to 4 concrete options that lead somewhere different. Put the one you recommend first, with " (Recommended)" at the end of its label, and say in each description what it gives and what it costs.
- Ask up to 4 related questions in one call rather than one call per question.
- The user may pick several options, write their own, or add a note. Follow their notes exactly.
- If they leave a question to you, decide it, and say what you chose and why.
- Never end a reply with a question or an offer for the user to answer, such as "Push both branches and open the two PRs?", "Want me to fix it?" or "Tell me if you want the other two fixed too". Ask it with ${ASK_TOOL} instead, with options like "Push and open PRs (Recommended)" and "Not yet", and carry on with their answer in the same run.
- Don't ask for permission to run a tool call that already asks for itself (approvals, git reviews), and don't ask the same thing twice.`;

export const AUTONOMOUS = `## Working on your own
The user wants you to work autonomously. Don't stop to ask questions or wait for confirmation. When something is open, make the sensible choice, carry on, and mention the choices that matter in your final reply.`;

export const COPYABLE = `## Text to copy
Text the user will likely copy and paste elsewhere always goes in a block of its own, which has a copy button; never leave it as a plain paragraph. Keep your commentary about it, such as length or alternatives, outside the block.
- Prose written for them (replies, reviews, messages, emails, commit or PR text): a markdown blockquote, every line starting with \`> \`. It's copied as written, so use markdown inside only where it's pasted as markdown (GitHub, commit messages), and plain text elsewhere (app store replies, emails, chat messages).
- Commands, snippets and file contents: a fenced code block tagged with its language, \`\`\`bash for shell commands (the app offers to run those in a terminal), \`\`\`ts, \`\`\`json and so on for code.`;

export const LEFT_TO_AGENT =
  "The user left these questions to you. Decide them, and say what you chose and why.";

/** Unanswered once first in line, a question goes on without the user after 5 minutes. */
export const QUESTION_AWAY_MS = 5 * 60_000;

/** What the model reads when the user is away: decide alone, with whatever they had answered but not sent. */
export function awayReply(draft: QuestionAnswer[] = []): string {
  const away =
    "The user is away: nobody answered these questions in 5 minutes. Decide them yourself and carry on, and say what you chose and why in your final reply. Ask again later only if it still matters.";
  const said = draft.filter((a) => a.choices.length || a.note);
  if (!said.length) return away;
  return `${away}\n\nWhat they had answered before leaving, without sending it:\n\n${replyText(true, said)}`;
}

const Params = Type.Object({
  questions: Type.Array(
    Type.Object({
      question: Type.String({
        description: "The full question, ending with a question mark.",
      }),
      header: Type.Optional(
        Type.String({
          description: 'A label of one to three words, e.g. "Storage".',
        }),
      ),
      options: Type.Array(
        Type.Object({
          label: Type.String({ description: "The choice, in 1 to 5 words." }),
          description: Type.Optional(
            Type.String({ description: "What it gives and what it costs." }),
          ),
        }),
        { minItems: 2, maxItems: 4 },
      ),
      multiSelect: Type.Optional(
        Type.Boolean({ description: "Let the user pick several options." }),
      ),
    }),
    { minItems: 1, maxItems: 4 },
  ),
});

/** Whether the app's settings leave questions on (`[conversation] ask_questions`). */
export async function askEnabled(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const conversation = settings.conversation as
      { ask_questions?: unknown } | undefined;
    return conversation?.ask_questions !== false;
  } catch {
    return true;
  }
}

/** What the model reads back: each question with the user's answer. */
export function replyText(
  approved: boolean,
  answers: QuestionAnswer[] = [],
): string {
  if (!approved) return LEFT_TO_AGENT;
  // Each answer's images are numbered from @image1, so say where they sit among all the attached ones.
  let first = 1;
  return answers
    .map((answer) => {
      const text = answerText(answer, first);
      first += answer.images?.length ?? 0;
      return text;
    })
    .join("\n\n");
}

function answerText(
  { question, choices, note, images }: QuestionAnswer,
  first: number,
) {
  const count = images?.length ?? 0;
  return [
    `Q: ${question}`,
    ...answerLines(choices, count),
    ...(note ? [`Note: ${note}`] : []),
    ...imageLines(count, first),
  ].join("\n");
}

function answerLines(choices: string[], images: number) {
  if (choices.length) return choices.map((c) => `A: ${c}`);
  return [
    images ? "A: (see the attached images)" : "A: (left to you; decide it)",
  ];
}

function imageLines(count: number, first: number) {
  if (count === 0) return [];
  if (count === 1) {
    return [`Image: attached image ${first} below is this answer's @image1.`];
  }
  const last = first + count - 1;
  return [
    `Images: attached images ${first}-${last} below are this answer's @image1-@image${count}.`,
  ];
}

/** The result's details: the answers with their images counted. */
export function askDetails(answers: QuestionAnswer[]): AskDetails {
  return {
    answers: answers.map(({ images, ...rest }) => ({
      ...rest,
      ...(images?.length && { images: images.length }),
    })),
  };
}

export default function ask(pi: ExtensionAPI) {
  const userWrote = nudgeStops(pi);
  pi.registerTool({
    name: ASK_TOOL,
    label: "Ask the user",
    description:
      "Ask the user 1 to 4 multiple-choice questions and wait for their answers. " +
      "Use it for decisions the request leaves open. The user can pick options, " +
      "write their own answer, add notes, or leave a question to you.",
    parameters: Params,
    async execute(toolCallId, _params, signal) {
      const reply = await new Promise<{
        approved: boolean;
        answers?: QuestionAnswer[];
        reason?: string;
      }>((resolve) => {
        signal?.addEventListener("abort", () => resolve({ approved: false }));
        pi.events.emit(APPROVAL_EVENT, {
          request: { toolCallId },
          answer: (approved, answers, _always, reason) =>
            resolve({ approved, answers, reason }),
          away: { afterMs: QUESTION_AWAY_MS, reason: awayReply },
          signal,
        } satisfies ApprovalAsk);
      });
      const text = reply.reason ?? replyText(reply.approved, reply.answers);
      const answered = reply.approved && !reply.reason && reply.answers;
      if (!answered)
        return { content: [{ type: "text", text }], details: undefined };
      const images = answered.flatMap((a) => a.images ?? []);
      return {
        content: [{ type: "text" as const, text }, ...images],
        details: askDetails(answered),
      };
    },
  });

  pi.on("before_agent_start", async (event) => {
    userWrote(event);
    const asking = await askEnabled();
    const others = pi.getActiveTools().filter((name) => name !== ASK_TOOL);
    pi.setActiveTools(asking ? [...others, ASK_TOOL] : others);
    const { sections } = event.systemPromptOptions;
    sections.questions = asking ? ASKING : AUTONOMOUS;
    sections.copyable = COPYABLE;
  });
}
