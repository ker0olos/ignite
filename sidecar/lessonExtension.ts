/**
 * Lessons: the agent writes down its mistakes (lesson_add) so no later
 * conversation repeats them. A tool_call lesson blocks the call it's about;
 * a system_prompt lesson is in every run's system prompt.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../shared/lessons.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import {
  addLesson,
  lessonFor,
  lessonIn,
  lessonsFor,
  list,
  readLessons,
  recordHit,
  removeLesson,
  type Lesson,
} from "./lessons.ts";
import { folderOf } from "./worktreeGit.ts";

export const LESSONS_FILE = join(homedir(), `.${APP_NAME}`, "lessons.json");

export const LESSON_GUIDANCE =
  "When you get something wrong that you could get wrong again (the user corrects you, you admit a mistake, " +
  "or you say you'll do something differently from now on), call lesson_add in the same turn. " +
  "The next conversation remembers nothing else, so a promise without a lesson is broken.";

const DECLINED = "The user kept the lesson as it is.";

const heldReason = (l: Lesson) =>
  `Held by a lesson from a past mistake [${l.id}]: ${l.text}\n` +
  "If this call already follows it, make the same call again.";

const blockedReason = (l: Lesson) =>
  `Blocked by a lesson from a past mistake [${l.id}]: ${l.text}\n` +
  "Do it another way. If the user explicitly asks for exactly this, lesson_remove asks them to remove the lesson.";

const Params = Type.Object({
  text: Type.String({
    description:
      "One imperative line and why, e.g. 'Never pass --no-verify to git commit: the user never asked and it skips their hooks.'",
  }),
  level: Type.Union(
    [Type.Literal("tool_call"), Type.Literal("system_prompt")],
    {
      description:
        "tool_call (preferred): shown exactly when you call `tool`. system_prompt: in every system prompt; only for lessons no single tool is about.",
    },
  ),
  tool: Type.Optional(
    Type.String({
      description:
        "For tool_call: the exact tool name (bash, git, edit, mcp__github) or MCP tool name (create_issue).",
    }),
  ),
  match: Type.Optional(
    Type.String({
      description:
        "For tool_call: exact text (3+ characters) that only the mistaken call's arguments contain, e.g. --no-verify. " +
        "Arguments read as their values joined by spaces (git's args as `commit -m x`), without your `reason`. " +
        "A call containing it is always blocked. Leave it out for a reminder before the tool's first call in each conversation.",
    }),
  ),
  folder_only: Type.Optional(
    Type.Boolean({
      description: "True when the lesson is about this folder only.",
    }),
  ),
  replaces: Type.Optional(
    Type.String({
      description:
        "The id of a lesson this one updates or merges. The user is asked first.",
    }),
  ),
});

const done = (text: string) => ({
  content: [{ type: "text" as const, text }],
  details: undefined,
});

const confirm = (
  pi: ExtensionAPI,
  toolCallId: string,
  reason: string,
  signal?: AbortSignal,
) =>
  new Promise<boolean>((resolve) => {
    signal?.addEventListener("abort", () => resolve(false));
    pi.events.emit(APPROVAL_EVENT, {
      request: { toolCallId, reason },
      answer: (approved) => resolve(approved),
    } satisfies ApprovalAsk);
  });

function registerAdd(pi: ExtensionAPI, file: string) {
  pi.registerTool({
    name: LESSON_ADD_TOOL,
    label: "Lesson",
    description:
      "Save a lesson from a mistake so no later conversation repeats it. Saved at once; the user is asked only to replace one.",
    parameters: Params,
    async execute(id, params, signal, _onUpdate, ctx) {
      const { folder_only, replaces, ...fields } = params;
      const folder = folderOf(ctx.cwd);
      if (replaces) {
        const old = lessonIn(file, folder, replaces);
        const ask = `Replace the lesson "${old.text}" with "${fields.text}"?`;
        if (!(await confirm(pi, id, ask, signal))) return done(DECLINED);
      }
      const scope = folder_only ? folder : undefined;
      const lesson = addLesson(file, { ...fields, folder: scope }, replaces);
      const others = lessonsFor(readLessons(file), folder).filter(
        (l) => l.id !== lesson.id && l.tool === lesson.tool,
      );
      const similar = others.length
        ? `\n\nOther lessons here for the same tool; if one says the same, merge them with \`replaces\`:\n${list(others)}`
        : "";
      return done(`Saved lesson [${lesson.id}].${similar}`);
    },
  });
}

function registerRemove(pi: ExtensionAPI, file: string) {
  pi.registerTool({
    name: LESSON_REMOVE_TOOL,
    label: "Remove lesson",
    description:
      "Remove a saved lesson, when the user asks for it. The user is asked first.",
    parameters: Type.Object({ id: Type.String() }),
    async execute(toolCallId, { id }, signal, _onUpdate, ctx) {
      const lesson = lessonIn(file, folderOf(ctx.cwd), id);
      const ask = `Remove the lesson "${lesson.text}"?`;
      if (!(await confirm(pi, toolCallId, ask, signal))) return done(DECLINED);
      removeLesson(file, id);
      return done(`Removed lesson [${id}].`);
    },
  });
}

export default function lessons(pi: ExtensionAPI, file = LESSONS_FILE) {
  // Read once per conversation: a system prompt that changes loses its prompt cache.
  let prompt: string | undefined;
  const reminded = new Set<string>();

  registerAdd(pi, file);
  registerRemove(pi, file);

  pi.on("before_agent_start", (event, ctx) => {
    prompt ??= list(
      lessonsFor(readLessons(file), folderOf(ctx.cwd)).filter(
        (l) => l.level === "system_prompt",
      ),
    );
    const saved = prompt ? `\n\nLessons from past mistakes:\n${prompt}` : "";
    return {
      systemPrompt: `${event.systemPrompt}\n\n${LESSON_GUIDANCE}${saved}`,
    };
  });

  pi.on("tool_call", (event, ctx) => {
    const all = lessonsFor(readLessons(file), folderOf(ctx.cwd));
    const input = event.input as Record<string, unknown>;
    const lesson = lessonFor(all, event.toolName, input, reminded);
    if (!lesson) return;
    reminded.add(lesson.id);
    recordHit(file, lesson.id);
    return {
      block: true,
      reason: lesson.match ? blockedReason(lesson) : heldReason(lesson),
    };
  });
}
