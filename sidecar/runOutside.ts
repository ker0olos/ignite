import {
  createBashTool,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { runBackground } from "./bashExtension.ts";
import { withDoppler } from "./doppler.ts";
import { skippable } from "./skipWait.ts";

/** Runs a bash call outside the sandbox, as the user approved; never throws. */
// ponytail: pi's default shell, not a shellPath or commandPrefix from pi's settings.
export async function runOutside(
  toolCallId: string,
  input: Record<string, unknown>,
  ctx: ExtensionContext,
) {
  try {
    if (input.background) {
      const done = await runBackground(toolCallId, input as never, ctx);
      return { ...done, isError: done.isError ?? false };
    }
    const done = await skippable(toolCallId, (spawnHook) =>
      createBashTool(ctx.cwd, { spawnHook: withDoppler(spawnHook) }).execute(
        toolCallId,
        input as never,
        ctx.signal,
      ),
    );
    const { content, details, isError = false } = done;
    return { content, details, isError };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text }], isError: true };
  }
}
