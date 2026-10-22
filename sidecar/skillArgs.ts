/** A skill's arguments as its SKILL.md frontmatter names them, for the composer. */
import { readFileSync } from "node:fs";
import { parseFrontmatter, type Skill } from "@earendil-works/pi-coding-agent";
import type { SkillInfo } from "../shared/skills.ts";

type Args = Pick<SkillInfo, "argumentHint" | "argumentDescriptions">;

// pi keeps its Skill objects until the session reloads its skills, so each file is read once per load.
const cache = new WeakMap<Skill, Args>();

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Claude Code's `argument-hint` (unquoted, YAML reads `[a, b]` as a list) and
 * the app's own `argument-descriptions`, one line per argument in order.
 */
function readArgs(filePath: string): Args {
  const { frontmatter } = parseFrontmatter(readFileSync(filePath, "utf8"));
  const raw = frontmatter["argument-hint"];
  const hint = text(Array.isArray(raw) ? `[${raw.join(", ")}]` : raw);
  const lines = frontmatter["argument-descriptions"];
  const descriptions = Array.isArray(lines)
    ? lines.map((l) => text(l) ?? "")
    : [];
  return {
    ...(hint && { argumentHint: hint }),
    ...(descriptions.some(Boolean) && { argumentDescriptions: descriptions }),
  };
}

function argsOf(skill: Skill): Args {
  let args = cache.get(skill);
  if (!args) {
    try {
      args = readArgs(skill.filePath);
    } catch {
      args = {};
    }
    cache.set(skill, args);
  }
  return args;
}

/** A session's skill as the composer shows it: name, description and its arguments. */
export function skillInfo(skill: Skill): SkillInfo {
  return { name: skill.name, description: skill.description, ...argsOf(skill) };
}
