/**
 * The app's skills in pi's agent dir: standalone ones in skills/ and plugins,
 * each a folder of skills in plugins/. Which are off, and which are always
 * on (their whole text in every prompt), is kept in skills.json.
 * Sessions load these and the folder's own, never other apps' (pi would read
 * ~/.agents/skills); those are imported by copying instead.
 */
import { existsSync, readdirSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type {
  PluginSkill,
  SkillCatalog,
  SkillEntry,
  SkillInfo,
} from "../shared/skills.ts";
import {
  findSkillSources,
  loadSkills,
  type SkillSource,
} from "./skillCatalog.ts";
import { alwaysText, isUnder, skillState } from "./skillState.ts";

const info = ({ name, description }: Skill): SkillInfo => ({
  name,
  description,
});

/** Skills that ship with the app, such as code-review. */
const BUILT_IN = fileURLToPath(import.meta.resolve("./skills"));

/** A skill's own folder, or its file when it's a lone .md. */
const origin = (skill: Skill) =>
  basename(skill.filePath) === "SKILL.md"
    ? dirname(skill.filePath)
    : skill.filePath;

/** A name that is one path segment and never `.` or `..`. */
const segment = (name: string) =>
  name.replace(/[^A-Za-z0-9_-]+/g, "-") || "skill";

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
async function plugin(
  pluginsDir: string,
  name: string,
  disabled: string[],
  entry: (skill: Skill) => PluginSkill,
) {
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
    enabled: !isUnder(id, disabled),
    always: false,
    skills: loadSkills(dir).map(entry),
  };
}

/** The skills and plugins in `agentDir`; other apps' are found under `home`. */
export function createSkillStore(agentDir: string, home: string) {
  const skillsDir = join(agentDir, "skills");
  const pluginsDir = join(agentDir, "plugins");

  const idOf = (skill: Skill) =>
    relative(agentDir, origin(skill)).split(sep).join("/");

  const state = skillState(join(agentDir, "skills.json"));

  const entry = (skill: Skill, always: string[]): PluginSkill => ({
    id: idOf(skill),
    ...info(skill),
    always: always.includes(idOf(skill)),
  });

  const pluginDirs = () => foldersIn(pluginsDir);

  async function list(): Promise<SkillEntry[]> {
    const { disabled, always } = state.read();
    const standalone = loadSkills(skillsDir).map((skill) => ({
      ...entry(skill, always),
      enabled: !isUnder(idOf(skill), disabled),
    }));
    const plugins = await Promise.all(
      pluginDirs().map((name) =>
        plugin(pluginsDir, name, disabled, (s) => entry(s, always)),
      ),
    );
    return [...standalone, ...plugins];
  }

  /** Throws unless `id` is a skill or plugin, or a plugin's skill. */
  async function known(id: string) {
    const entries = (await list()).flatMap((e) => [e, ...(e.skills ?? [])]);
    if (!entries.some((entry) => entry.id === id)) {
      throw new Error("That skill is no longer there.");
    }
  }

  /** The app's skills that are on, skipping names already in `taken` (which it fills). */
  function appSkills(taken: Set<string>) {
    const { disabled } = state.read();
    return [
      ...loadSkills(skillsDir),
      ...pluginDirs()
        .filter((name) => !isUnder(`plugins/${name}`, disabled))
        .flatMap((name) => loadSkills(join(pluginsDir, name))),
    ].filter((s) => {
      const id = idOf(s);
      const outside = id.startsWith("..") || isAbsolute(id);
      if (outside || isUnder(id, disabled) || taken.has(s.name)) return false;
      taken.add(s.name);
      return true;
    });
  }

  /** Always-on skills: whole in the prompt, so no listed skill may share a name. */
  const alwaysOnSkills = () =>
    appSkills(new Set()).filter((s) => state.read().always.includes(idOf(s)));

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
      await state.mark("disabled", id, !enabled);
    },

    /** Puts a skill's whole text in every prompt, or back in the skills list. */
    async setAlways(id: string, always: boolean) {
      await known(id);
      await state.mark("always", id, always);
    },

    async remove(id: string) {
      await known(id);
      await rm(join(agentDir, id), { recursive: true, force: true });
      await state.forget(id);
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
     * app's that are on, then the built-in ones neither replaced. pi has already dropped name clashes by then, often in
     * favour of ~/.agents/skills, so the app's are loaded here, not filtered.
     */
    sessionSkills<T extends { skills: Skill[] }>(base: T): T {
      const pinned = new Set(alwaysOnSkills().map((s) => s.name));
      const project = base.skills.filter(
        (s) => s.sourceInfo.scope === "project" && !pinned.has(s.name),
      );
      const taken = new Set([...project.map((s) => s.name), ...pinned]);
      const ours = appSkills(taken);
      const builtIn = loadSkills(BUILT_IN).filter((s) => !taken.has(s.name));
      return { ...base, skills: [...project, ...ours, ...builtIn] };
    },

    /** An `appendSystemPromptOverride`: adds the always-on skills' whole text. */
    alwaysOn: (base: string[]): string[] => [
      ...base,
      ...alwaysOnSkills().map(alwaysText),
    ],
  };
}

export type SkillStore = ReturnType<typeof createSkillStore>;
