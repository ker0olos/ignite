/** bash_wait: the conversation runs again once a background command exits (hostWait.ts wakes it). */
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { open } from "node:fs/promises";
import { Type } from "typebox";
import { BASH_WAIT_TOOL } from "../shared/agentTypes.ts";
import { backgroundOf, type Background } from "./backgroundBash.ts";

const TAIL_BYTES = 4096;

async function tail(log: string) {
  const file = await open(log);
  try {
    const { size } = await file.stat();
    const length = Math.min(size, TAIL_BYTES);
    const { buffer } = await file.read({
      buffer: Buffer.alloc(length),
      position: size - length,
    });
    // Cut at a line, never inside a character.
    const start = size > length ? buffer.indexOf(0x0a) + 1 : 0;
    return buffer.subarray(start).toString("utf8").trimEnd();
  } finally {
    await file.close();
  }
}

/** What the agent is told once `b` has exited. */
export async function exitedText(b: Background) {
  const how =
    b.exitCode === undefined ? "was killed" : `exited with code ${b.exitCode}`;
  const out = await tail(b.log).catch(() => null);
  const end =
    out === null
      ? "; it couldn't be read."
      : out
        ? `; it ends:\n\n${out}`
        : "; it printed nothing.";
  return `Background command \`${b.command}\` (pid ${b.pid}) ${how}. Its full output is in ${b.log}${end}`;
}

/** Registers bash_wait. */
export default function bashWait(pi: ExtensionAPI) {
  pi.registerTool({
    name: BASH_WAIT_TOOL,
    label: "Wait for background command",
    description:
      "Wake up once a command started with bash's `background: true` exits: call it, then end your turn. " +
      "When it exits, you get its exit code and the end of its output as a new message and carry on. " +
      "Use it instead of telling the user you'll report back later, or sleeping until it's done.",
    promptSnippet: `${BASH_WAIT_TOOL}: continue once a background bash command exits`,
    parameters: Type.Object({
      pid: Type.Number({ description: "The pid bash reported." }),
    }),
    async execute(_id, { pid }, _signal, _onUpdate, ctx: ExtensionContext) {
      const session = ctx.sessionManager.getSessionId();
      const found = backgroundOf(session).find((b) => b.pid === pid);
      if (!found) {
        throw new Error(`No background command ${pid} in this conversation.`);
      }
      if (!found.running) {
        return {
          content: [{ type: "text", text: await exitedText(found) }],
          details: {},
        };
      }
      found.wake = true;
      return {
        content: [
          {
            type: "text",
            text: `You'll get a message when ${pid} exits. End your turn now unless there's other work to do meanwhile.`,
          },
        ],
        details: {},
      };
    },
  });
}
