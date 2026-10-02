// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { createSkillStore } from "./skillStore.ts";

let root: string;
let agentDir: string;
let home: string;

async function skill(dir: string, name: string, description = `${name}.`) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nDo ${name}.\n`,
  );
}

async function claudePlugin(name: string, skills: string[]) {
  const dir = join(home, "plugins-cache", name);
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, description: `The ${name} plugin.` }),
  );
  for (const s of skills) await skill(join(dir, "skills", s), s);
  await mkdir(join(home, ".claude", "plugins"), { recursive: true });
  await writeFile(
    join(home, ".claude", "plugins", "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: { [`${name}@market`]: [{ installPath: dir }] },
    }),
  );
  return dir;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skills-"));
  agentDir = join(root, "agent");
  home = join(root, "home");
  await mkdir(agentDir, { recursive: true });
});

const project = (name: string) =>
  ({
    name,
    description: "",
    filePath: `/work/.pi/skills/${name}/SKILL.md`,
    baseDir: `/work/.pi/skills/${name}`,
    sourceInfo: { scope: "project" },
  }) as unknown as Skill;
const other = (name: string) =>
  ({
    ...project(name),
    filePath: `${home}/.agents/skills/${name}/SKILL.md`,
    sourceInfo: { scope: "user" },
  }) as unknown as Skill;

describe("list", () => {
  it("lists standalone skills and plugins, all on", async () => {
    await skill(join(agentDir, "skills", "notes"), "notes");
    await skill(join(agentDir, "plugins", "kit", "a"), "a");
    await writeFile(
      join(agentDir, "plugins", "kit", "plugin.json"),
      JSON.stringify({ name: "Kit", description: "Tools." }),
    );
    await skill(join(agentDir, "plugins", "bare", "b"), "b");
    expect(await createSkillStore(agentDir, home).list()).toEqual([
      {
        id: "skills/notes",
        name: "notes",
        description: "notes.",
        enabled: true,
      },
      {
        id: "plugins/bare",
        name: "bare",
        description: "",
        enabled: true,
        skills: [{ name: "b", description: "b." }],
      },
      {
        id: "plugins/kit",
        name: "Kit",
        description: "Tools.",
        enabled: true,
        skills: [{ name: "a", description: "a." }],
      },
    ]);
  });

  it("is empty with no folders", async () => {
    expect(await createSkillStore(agentDir, home).list()).toEqual([]);
  });
});

describe("setEnabled and remove", () => {
  it("turns a skill off and on again", async () => {
    await skill(join(agentDir, "skills", "notes"), "notes");
    const store = createSkillStore(agentDir, home);
    await store.setEnabled("skills/notes", false);
    expect((await store.list())[0].enabled).toBe(false);
    await store.setEnabled("skills/notes", true);
    expect((await store.list())[0].enabled).toBe(true);
  });

  it("removes a plugin's folder and forgets it was off", async () => {
    await skill(join(agentDir, "plugins", "kit", "a"), "a");
    const store = createSkillStore(agentDir, home);
    await store.setEnabled("plugins/kit", false);
    await store.remove("plugins/kit");
    expect(existsSync(join(agentDir, "plugins", "kit"))).toBe(false);
    expect(
      JSON.parse(await readFile(join(agentDir, "skills.json"), "utf8")),
    ).toEqual({ disabled: [] });
  });

  it("refuses ids it doesn't list, so nothing outside is touched", async () => {
    const store = createSkillStore(agentDir, home);
    await expect(store.remove("../home")).rejects.toThrow("no longer there");
    await expect(store.setEnabled("skills/x", false)).rejects.toThrow();
  });

  it("ignores a skills.json it can't read", async () => {
    await skill(join(agentDir, "skills", "notes"), "notes");
    await writeFile(join(agentDir, "skills.json"), "{ nope");
    expect((await createSkillStore(agentDir, home).list())[0].enabled).toBe(
      true,
    );
  });
});

describe("catalog and importSkills", () => {
  it("finds other apps' skill folders and Claude Code plugins", async () => {
    await skill(join(home, ".codex", "skills", "fmt"), "fmt");
    await claudePlugin("supa", ["db", "auth"]);
    const { sources } = await createSkillStore(agentDir, home).catalog();
    expect(sources).toEqual([
      {
        id: join(home, ".codex/skills"),
        app: "Codex",
        label: "Skills",
        plugin: false,
        skills: [{ name: "fmt", description: "fmt.", added: false }],
      },
      {
        id: join(home, "plugins-cache", "supa"),
        app: "Claude Code",
        label: "supa",
        plugin: true,
        skills: [
          { name: "auth", description: "auth.", added: false },
          { name: "db", description: "db.", added: false },
        ],
      },
    ]);
  });

  it("copies a folder's skill, following symlinks, and marks it added", async () => {
    const real = join(root, "real", "fmt");
    await skill(real, "fmt");
    await mkdir(join(home, ".claude", "skills"), { recursive: true });
    await symlink(real, join(home, ".claude", "skills", "fmt"));
    const store = createSkillStore(agentDir, home);
    await store.importSkills(join(home, ".claude/skills"), ["fmt"]);
    expect(
      await readFile(join(agentDir, "skills", "fmt", "SKILL.md"), "utf8"),
    ).toContain("Do fmt.");
    const { sources } = await store.catalog();
    expect(sources[0].skills[0].added).toBe(true);
  });

  it("imports a plugin's skills as one plugin with its name", async () => {
    const dir = await claudePlugin("supa", ["db", "auth"]);
    const store = createSkillStore(agentDir, home);
    await store.importSkills(dir, ["db"]);
    expect(await store.list()).toEqual([
      {
        id: "plugins/supa",
        name: "supa",
        description: "The supa plugin.",
        enabled: true,
        skills: [{ name: "db", description: "db." }],
      },
    ]);
  });

  it("keeps a copied name inside the skills folder", async () => {
    await skill(join(home, ".agents", "skills", "x"), "../../evil");
    const store = createSkillStore(agentDir, home);
    await store.importSkills(join(home, ".agents/skills"), ["../../evil"]);
    expect(existsSync(join(agentDir, "skills", "-evil", "SKILL.md"))).toBe(
      true,
    );
  });

  it("refuses a source that's gone", async () => {
    await expect(
      createSkillStore(agentDir, home).importSkills("/gone", ["a"]),
    ).rejects.toThrow("no longer there");
  });
});

describe("sessionSkills", () => {
  it("keeps the folder's skills and the app's that are on, never other apps'", async () => {
    await skill(join(agentDir, "skills", "notes"), "notes");
    await skill(join(agentDir, "skills", "off"), "off");
    await skill(join(agentDir, "plugins", "kit", "a"), "a");
    await skill(join(agentDir, "plugins", "gone", "b"), "b");
    const store = createSkillStore(agentDir, home);
    await store.setEnabled("skills/off", false);
    await store.setEnabled("plugins/gone", false);
    const { skills } = store.sessionSkills({
      skills: [project("mine"), other("notes"), other("elsewhere")],
      diagnostics: [],
    });
    expect(skills.map((s) => s.name)).toEqual([
      "mine",
      "notes",
      "a",
      "code-review",
    ]);
    expect(skills[1].filePath).toBe(
      join(agentDir, "skills", "notes", "SKILL.md"),
    );
  });

  it("lets the folder's own skill win a name clash", async () => {
    await skill(join(agentDir, "skills", "mine"), "mine");
    const { skills } = createSkillStore(agentDir, home).sessionSkills({
      skills: [project("mine")],
      diagnostics: [],
    });
    expect(skills.filter((s) => s.name === "mine")).toEqual([project("mine")]);
  });

  it("adds the built-in code-review unless a skill of that name is loaded", async () => {
    const store = createSkillStore(agentDir, home);
    const none = { skills: [] as Skill[], diagnostics: [] };
    const builtIn = store.sessionSkills(none);
    expect(builtIn.skills.map((s) => s.name)).toEqual(["code-review"]);
    await skill(join(agentDir, "skills", "code-review"), "code-review");
    const { skills } = store.sessionSkills(none);
    expect(skills.map((s) => s.filePath)).toEqual([
      join(agentDir, "skills", "code-review", "SKILL.md"),
    ]);
  });
});
