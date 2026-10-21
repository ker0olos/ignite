/** bash_wait: the conversation runs again once its background commands exit (hostWait.ts wakes it). */
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { open } from "node:fs/promises";
import { Type } from "typebox";
import { BASH_WAIT_TOOL } from "../shared/agentTypes.ts";
import { backgroundOf, waitFor, type Background } from "./backgroundBash.ts";

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

/** What the agent is told once every command in `group` has exited. */
export const groupExitedText = async (group: Background[]) =>
  (await Promise.all(group.map(exitedText))).join("\n\n");

/** Registers bash_wait. */
export default function bashWait(pi: ExtensionAPI) {
  pi.registerTool({
    name: BASH_WAIT_TOOL,
    label: "Wait for background commands",
    description:
      "Wake up once commands started with bash's `background: true` have all exited: call it once with every pid, then end your turn. " +
      "When the last one exits, you get each one's exit code and the end of its output as a new message and carry on. " +
      "Use it instead of telling the user you'll report back later, or sleeping until they're done.",
    promptSnippet: `${BASH_WAIT_TOOL}: continue once background bash commands exit`,
    parameters: Type.Object({
      pids: Type.Optional(
        Type.Array(Type.Number(), { description: "The pids bash reported." }),
      ),
      // Calls made before it took several, which models copy from older context.
      pid: Type.Optional(Type.Number({ description: "One pid, as pids." })),
    }),
    async execute(_id, args, _signal, _onUpdate, ctx: ExtensionContext) {
      const pids = [...(args.pids ?? []), ...(args.pid ? [args.pid] : [])];
      if (!pids.length) throw new Error("Give the pids to wait on.");
      const session = ctx.sessionManager.getSessionId();
      const mine = backgroundOf(session);
      const group = [...new Set(pids)].map((pid) => {
        const found = mine.find((b) => b.pid === pid);
        if (!found) {
          throw new Error(`No background command ${pid} in this conversation.`);
        }
        return found;
      });
      if (group.every((b) => !b.running)) {
        return {
          content: [{ type: "text", text: await groupExitedText(group) }],
          details: {},
        };
      }
      waitFor(group);
      return {
        content: [
          {
            type: "text",
            text: `You'll get a message once ${group.map((b) => b.pid).join(", ")} ${group.length > 1 ? "have all" : "has"} exited. End your turn now unless there's other work to do meanwhile.`,
          },
        ],
        details: {},
      };
    },
  });
}
