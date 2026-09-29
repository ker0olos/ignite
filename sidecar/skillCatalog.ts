/**
 * Skills other apps keep on this Mac, offered for import: each app's skills
 * folder, and the skills bundled in Claude Code's installed plugins. The
 * other apps' files are only read.
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadSkillsFromDir, type Skill } from "@earendil-works/pi-coding-agent";

/** One app's skills folder, or one Claude Code plugin. */
export type SkillSource = {
  /** The folder it was found in. */
  id: string;
  app: string;
  label: string;
  description: string;
  /** Imports as one plugin rather than standalone skills. */
  plugin: boolean;
  skills: Skill[];
};

const FOLDERS = [
  ["Claude Code", ".claude/skills"],
  ["Codex", ".codex/skills"],
  ["Cursor", ".cursor/skills"],
  ["Agent Skills", ".agents/skills"],
] as const;

type Json = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" ? v : undefined);

/** A folder's skills, as pi would load them. */
export const loadSkills = (dir: string) =>
  loadSkillsFromDir({ dir, source: "app" }).skills;

async function readJson(path: string): Promise<Json | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** A plugin's skills folders: plugin.json's `skills` (one or several), else skills/. */
const skillPaths = (manifest: Json) =>
  [manifest.skills ?? "skills"]
    .flat()
    .filter((p): p is string => typeof p === "string");

async function claudePlugin(
  key: string,
  installs: unknown,
): Promise<SkillSource | undefined> {
  const dir = Array.isArray(installs)
    ? text((installs[0] as Json | undefined)?.installPath)
    : undefined;
  if (!dir) return undefined;
  const manifest =
    (await readJson(join(dir, ".claude-plugin", "plugin.json"))) ?? {};
  return {
    id: dir,
    app: "Claude Code",
    label: text(manifest.name) ?? key.split("@")[0],
    description: text(manifest.description) ?? "",
    plugin: true,
    skills: skillPaths(manifest).flatMap((p) => loadSkills(resolve(dir, p))),
  };
}

async function claudePlugins(home: string) {
  const installed = await readJson(
    join(home, ".claude", "plugins", "installed_plugins.json"),
  );
  const plugins = installed?.plugins;
  if (!plugins || typeof plugins !== "object") return [];
  const found = await Promise.all(
    Object.entries(plugins).map(([key, installs]) =>
      claudePlugin(key, installs),
    ),
  );
  return found.filter((s) => s !== undefined);
}

/** Every source with at least one skill. */
export async function findSkillSources(home: string): Promise<SkillSource[]> {
  const folders = FOLDERS.map(([app, path]) => ({
    id: join(home, path),
    app,
    label: "Skills",
    description: "",
    plugin: false,
    skills: loadSkills(join(home, path)),
  }));
  return [...folders, ...(await claudePlugins(home))].filter(
    (s) => s.skills.length > 0,
  );
}
