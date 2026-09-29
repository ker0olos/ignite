/**
 * The app's skills in pi's agent dir: standalone ones in skills/ and plugins,
 * each a folder of skills in plugins/. Which are off is kept in skills.json.
 * Sessions load these and the folder's own, never other apps' (pi would read
 * ~/.agents/skills); those are imported by copying instead.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type { SkillCatalog, SkillEntry, SkillInfo } from "../shared/skills.ts";
import {
  findSkillSources,
  loadSkills,
  type SkillSource,
} from "./skillCatalog.ts";

const info = ({ name, description }: Skill): SkillInfo => ({
  name,
  description,
});

/** A skill's own folder, or its file when it's a lone .md. */
const origin = (skill: Skill) =>
  basename(skill.filePath) === "SKILL.md"
    ? dirname(skill.filePath)
    : skill.filePath;

/** A name that is one path segment and never `.` or `..`. */
const segment = (name: string) =>
  name.replace(/[^A-Za-z0-9_-]+/g, "-") || "skill";

/** The ids turned off in skills.json; none if it's missing or unreadable. */
function disabledIn(statePath: string): string[] {
  try {
    const { disabled } = JSON.parse(readFileSync(statePath, "utf8"));
    return Array.isArray(disabled)
      ? disabled.filter((d) => typeof d === "string")
      : [];
  } catch {
    return [];
  }
}

/** Whether `id` or a folder holding it is off. */
const isOff = (id: string, disabled: string[]) =>
  disabled.some((d) => id === d || id.startsWith(`${d}/`));

function foldersIn(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** A plugin folder, named by its plugin.json, else by the folder. */
async function plugin(pluginsDir: string, name: string, disabled: string[]) {
  const dir = join(pluginsDir, name);
  const id = `plugins/${name}`;
  let manifest: Partial<SkillInfo> = {};
  try {
    manifest = JSON.parse(await readFile(join(dir, "plugin.json"), "utf8"));
  } catch {
    // No manifest: named after its folder.
  }
  return {
    id,
    name: manifest.name ?? name,
    description: manifest.description ?? "",
    enabled: !isOff(id, disabled),
    skills: loadSkills(dir).map(info),
  };
}

/** The skills and plugins in `agentDir`; other apps' are found under `home`. */
export function createSkillStore(agentDir: string, home: string) {
  const skillsDir = join(agentDir, "skills");
  const pluginsDir = join(agentDir, "plugins");
  const statePath = join(agentDir, "skills.json");

  const idOf = (skill: Skill) =>
    relative(agentDir, origin(skill)).split(sep).join("/");

  const readDisabled = () => disabledIn(statePath);

  const writeDisabled = (disabled: string[]) =>
    writeFile(statePath, JSON.stringify({ disabled }, null, 2) + "\n");

  const pluginDirs = () => foldersIn(pluginsDir);

  async function list(): Promise<SkillEntry[]> {
    const disabled = readDisabled();
    const standalone = loadSkills(skillsDir).map((skill) => ({
      id: idOf(skill),
      ...info(skill),
      enabled: !isOff(idOf(skill), disabled),
    }));
    const plugins = await Promise.all(
      pluginDirs().map((name) => plugin(pluginsDir, name, disabled)),
    );
    return [...standalone, ...plugins];
  }

  async function known(id: string) {
    if (!(await list()).some((entry) => entry.id === id)) {
      throw new Error("That skill is no longer there.");
    }
  }

  /** Where a source's skill is copied to. */
  const target = (source: SkillSource, skill: Skill) =>
    source.plugin
      ? join(pluginsDir, segment(source.label), segment(skill.name))
      : join(
          skillsDir,
          segment(skill.name) + (origin(skill) === skill.filePath ? ".md" : ""),
        );

  return {
    list,

    async setEnabled(id: string, enabled: boolean) {
      await known(id);
      const rest = readDisabled().filter((d) => d !== id);
      await writeDisabled(enabled ? rest : [...rest, id]);
    },

    async remove(id: string) {
      await known(id);
      await rm(join(agentDir, id), { recursive: true, force: true });
      await writeDisabled(readDisabled().filter((d) => d !== id));
    },

    async catalog(): Promise<SkillCatalog> {
      const sources = await findSkillSources(home);
      return {
        sources: sources.map((source) => ({
          id: source.id,
          app: source.app,
          label: source.label,
          plugin: source.plugin,
          skills: source.skills.map((skill) => ({
            ...info(skill),
            added: existsSync(target(source, skill)),
          })),
        })),
      };
    },

    /** Copies `names` from a source, replacing earlier copies. */
    async importSkills(sourceId: string, names: string[]) {
      const source = (await findSkillSources(home)).find(
        (s) => s.id === sourceId,
      );
      if (!source) throw new Error("Those skills are no longer there.");
      for (const skill of source.skills.filter((s) => names.includes(s.name))) {
        const dest = target(source, skill);
        await rm(dest, { recursive: true, force: true });
        await mkdir(dirname(dest), { recursive: true });
        await cp(origin(skill), dest, { recursive: true, dereference: true });
      }
      if (source.plugin) {
        const { label: name, description } = source;
        await writeFile(
          join(pluginsDir, segment(name), "plugin.json"),
          JSON.stringify({ name, description }, null, 2) + "\n",
        );
      }
    },

    /**
     * A resource loader `skillsOverride`: the folder's own skills, then the
     * app's that are on. pi has already dropped name clashes by then, often in
     * favour of ~/.agents/skills, so the app's are loaded here, not filtered.
     */
    sessionSkills<T extends { skills: Skill[] }>(base: T): T {
      const disabled = readDisabled();
      const project = base.skills.filter(
        (s) => s.sourceInfo.scope === "project",
      );
      const taken = new Set(project.map((s) => s.name));
      const ours = [
        ...loadSkills(skillsDir),
        ...pluginDirs()
          .filter((name) => !isOff(`plugins/${name}`, disabled))
          .flatMap((name) => loadSkills(join(pluginsDir, name))),
      ].filter((s) => {
        const id = idOf(s);
        const outside = id.startsWith("..") || isAbsolute(id);
        if (outside || isOff(id, disabled) || taken.has(s.name)) return false;
        taken.add(s.name);
        return true;
      });
      return { ...base, skills: [...project, ...ours] };
    },
  };
}

export type SkillStore = ReturnType<typeof createSkillStore>;
