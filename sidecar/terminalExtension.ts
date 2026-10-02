/** terminal_read, and what the user's terminals printed since the agent last looked, added to each run like Claude Code's `!`. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TERMINAL_READ_TOOL } from "../shared/terminal.ts";
import { readTerminals, unseenTerminals } from "./terminal.ts";
import { folderOf } from "./worktreeGit.ts";

/** What the composer's `@` mentions in the user's messages point at. */
export const MENTION_GUIDANCE =
  "In the user's messages, `@image1`, `@image2`… are the images attached to that message, in order; " +
  `\`@t1\`, \`@t2\`… are their terminals (read one with ${TERMINAL_READ_TOOL}); ` +
  "and `@path` is a file or folder in the project.";

export default function terminal(pi: ExtensionAPI) {
  pi.registerTool({
    name: TERMINAL_READ_TOOL,
    label: "Read terminal",
    description:
      "Read the user's own terminals open in this folder: the commands they ran and what printed, " +
      "as the screen shows it. New output is also added to each message they send.",
    promptSnippet: `${TERMINAL_READ_TOOL}: read what the user ran in their terminal and its output`,
    parameters: Type.Object({
      terminal: Type.Optional(
        Type.String({
          description:
            "One terminal's id (e.g. t1); all of the folder's when left out.",
        }),
      ),
      lines: Type.Optional(
        Type.Number({
          description: "How many lines from the end, default 200.",
          minimum: 1,
          maximum: 5000,
        }),
      ),
    }),
    async execute(_id, { terminal, lines }, _signal, _onUpdate, ctx) {
      const text = readTerminals(
        ctx.sessionManager.getSessionId(),
        folderOf(ctx.cwd),
        lines ?? 200,
        terminal,
      );
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  pi.on("before_agent_start", (event, ctx) => {
    const systemPrompt = `${event.systemPrompt}\n\n${MENTION_GUIDANCE}`;
    const text = unseenTerminals(
      ctx.sessionManager.getSessionId(),
      folderOf(ctx.cwd),
    );
    if (!text) return { systemPrompt };
    return {
      systemPrompt,
      message: {
        customType: "terminal",
        content: `The user's terminal since you last saw it:\n\n${text}`,
        display: false,
      },
    };
  });
}
