/** Holds the tool calls that need a workspace's ignored files (dependencies, builds, .env) until they're cloned in. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GIT_TOOL } from "../shared/git.ts";
import { whenReady } from "./worktreeReady.ts";

const WRITERS = new Set(["write", "edit", "bash", GIT_TOOL]);

// read's `path`, and each of its `also` parts'.
function readPaths(input: Record<string, unknown>): string[] {
  const also = Array.isArray(input.also) ? (input.also as unknown[]) : [];
  return [
    input.path,
    ...also.map((a) => (a as { path?: unknown })?.path),
  ].filter((p): p is string => typeof p === "string");
}

/** Whether a `toolName` call waits for the workspace: it writes or runs commands, or reads a file that may still be on its way. */
export function waitsForReady(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
) {
  if (WRITERS.has(toolName)) return true;
  if (toolName !== "read") return false;
  return readPaths(input).some((p) => !existsSync(resolve(cwd, p)));
}

const stopped = (signal: AbortSignal | undefined) =>
  new Promise<void>((done) => {
    if (signal?.aborted) done();
    signal?.addEventListener("abort", () => done(), { once: true });
  });

export default function ready(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const input = event.input as Record<string, unknown>;
    if (!waitsForReady(event.toolName, input, ctx.cwd)) return;
    await Promise.race([whenReady(ctx.cwd), stopped(ctx.signal)]);
  });
}
