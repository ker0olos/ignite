/** The reflector's points (~/.ignite/reflector.json, see reflector.ts), each added to the prompt beside the guidance of its entry point. */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ASK_TOOL } from "../shared/questions.ts";
import {
  ENTRY_POINTS,
  type EntryPoint,
  type Reflection,
  TAUGHT_BY,
} from "../shared/reflector.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { learningOn } from "./learningSettings.ts";

export const REFLECTOR_FILE = join(homedir(), `.${APP_NAME}`, "reflector.json");

// A hand-edited file may hold anything; Settings and the prompt read only whole points.
const isPoint = (p: Partial<Reflection> | null): p is Reflection =>
  typeof p?.id === "string" &&
  typeof p.text === "string" &&
  typeof p.at === "number" &&
  typeof p.entry === "string" &&
  p.entry in ENTRY_POINTS &&
  typeof p.taught === "string" &&
  p.taught in TAUGHT_BY &&
  ["undefined", "string"].includes(typeof p.when) &&
  ["undefined", "string"].includes(typeof p.evidence);

/** Every whole point; none when the file is missing or unreadable. */
export function readReflections(file = REFLECTOR_FILE): Reflection[] {
  try {
    const all = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(all) ? all.filter(isPoint) : [];
  } catch {
    return [];
  }
}

/** Replaces every point. */
export function writeReflections(all: Reflection[], file = REFLECTOR_FILE) {
  writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`);
}

// The sections holding each entry point's guidance, the first one present taken; "always" has its own.
const SECTIONS: Record<Exclude<EntryPoint, "always">, string[]> = {
  asking: ["questions"],
  planning: ["plan", "task"],
  delivering: ["worktree"],
  delegating: ["subagents"],
};

// The evidence stays out: it's for the reflector, and would cost every conversation's prompt.
const bullets = (points: Reflection[]) =>
  points
    .map((p) => `- ${p.when ? `When ${p.when}: ` : ""}${p.text}`)
    .join("\n");

/** The prompt's sections with the points added, each where its entry point's guidance is; a point whose entry point isn't in this conversation is left out. */
export function placeReflections(
  sections: Record<string, string | undefined>,
  points: Reflection[],
  asking: boolean,
) {
  const always = points.filter((p) => p.entry === "always");
  if (always.length)
    sections.reflector = `## How the user wants you to work\nLearned from the user's feedback on earlier conversations; follow it unless they say otherwise.\n${bullets(always)}`;
  for (const [entry, keys] of Object.entries(SECTIONS)) {
    const own = points.filter((p) => p.entry === entry);
    const key = keys.find((k) => sections[k]);
    if (!own.length || !key || (entry === "asking" && !asking)) continue;
    sections[key] +=
      `\n\nThe user's own way here, learned from their feedback:\n${bullets(own)}`;
  }
}

export default function reflector(
  pi: ExtensionAPI,
  file = REFLECTOR_FILE,
  settingsFile?: string,
) {
  // Read once per conversation: a system prompt that changes loses its prompt cache.
  let points: Reflection[] | undefined;
  pi.on("before_agent_start", async (event) => {
    if (!(await learningOn("reflector", settingsFile))) return;
    points ??= readReflections(file);
    const asking = pi.getActiveTools().includes(ASK_TOOL);
    placeReflections(event.systemPromptOptions.sections, points, asking);
  });
}
